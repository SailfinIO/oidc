import {
  ATTRIBUTE_ASN1_TYPES,
  GENERALIZED_TIME_REGEX,
  UTC_REGEX,
} from '../constants/key-constants';
import {
  AttributeTypeAndValue,
  ExtensionParser,
  IAlgorithmIdentifier,
  IExtension,
  IName,
  IRelativeDistinguishedName,
  ISubjectPublicKeyInfo,
  IValidity,
  ParsedExtensionData,
  ParsedKeyUsage,
  SubjectAltName,
} from '../interfaces';
import {
  decodeBitString,
  decodeDER,
  decodeInteger,
  decodeObjectIdentifier,
  decodeSequence,
} from './derUtils';
import { BinaryToTextEncoding, DERTag } from '../enums';
import { ClientError } from '../errors';

const TAG_CLASS_UNIVERSAL = 0x00;
const TAG_CLASS_APPLICATION = 0x40;
const TAG_CLASS_CONTEXT_SPECIFIC = 0x80;
const TAG_CLASS_PRIVATE = 0xc0;

export class ExtensionParsers {
  public static parseName = (data: Buffer): IName => {
    const { elements: rdnElements } = decodeSequence(data, 0);

    if (!rdnElements || rdnElements.length === 0) {
      throw new ClientError('Invalid or empty RDN sequence in Name structure.');
    }
    const rdnSequence: IRelativeDistinguishedName[] = [];

    for (const rdnElement of rdnElements) {
      // Each RelativeDistinguishedName is a SET of AttributeTypeAndValue
      const { elements: attrElements } = decodeSequence(rdnElement.content, 0);
      const attributes: AttributeTypeAndValue[] = [];

      for (const attrElement of attrElements) {
        // Each AttributeTypeAndValue is a SEQUENCE { type, value }
        const { elements } = decodeSequence(attrElement.content, 0);
        const oid = decodeObjectIdentifier(elements[0].content, 0).oid;

        // Determine the ASN.1 type based on OID
        const asn1Type = ATTRIBUTE_ASN1_TYPES[oid] || DERTag.UTF8_STRING;

        let value: string | number | Buffer;

        switch (asn1Type) {
          case DERTag.PRINTABLE_STRING:
          case DERTag.IA5_STRING:
          case DERTag.UTF8_STRING:
            value = elements[1].content.toString(BinaryToTextEncoding.UTF_8);
            break;
          case DERTag.INTEGER:
            value = elements[1].content.readUInt32BE(0);
            break;
          default:
            // For unknown types, return raw buffer
            value = elements[1].content;
            break;
        }

        attributes.push({ type: oid, value });
      }

      rdnSequence.push({ attributes });
    }

    return { rdnSequence };
  };

  public static parseValidity = (data: Buffer): IValidity => {
    // Validity is a SEQUENCE of two Time fields
    const elements = ExtensionParsers.ensureSequenceLength(
      data,
      2,
      ExtensionParsers.parseValidity.name,
    );

    if (elements.length !== 2) {
      throw new Error('Invalid Validity structure');
    }
    const notBeforeElement = elements[0];
    const notAfterElement = elements[1];

    // Assuming first element is notBefore and second is notAfter
    const notBefore = this.parseTime(
      notBeforeElement.content,
      notBeforeElement.tag,
    );
    const notAfter = this.parseTime(
      notAfterElement.content,
      notAfterElement.tag,
    );

    return { notBefore, notAfter };
  };

  private static parseUTCTime(timeStr: string): Date {
    const match = UTC_REGEX.exec(timeStr);
    if (!match) {
      throw new Error(`Invalid UTCTime format: ${timeStr}`);
    }
    const twoDigitYear = parseInt(match[1], 10);
    const year = twoDigitYear >= 50 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  private static parseGeneralizedTime(timeStr: string): Date {
    const match = GENERALIZED_TIME_REGEX.exec(timeStr);
    if (!match) {
      throw new Error(`Invalid GeneralizedTime format: ${timeStr}`);
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  public static parseTime = (data: Buffer, tag: number): Date => {
    const timeStr = data.toString(BinaryToTextEncoding.ASCII).trim();
    if (tag === DERTag.UTCTime) {
      return this.parseUTCTime(timeStr);
    } else if (tag === DERTag.GENERALIZED_TIME) {
      return this.parseGeneralizedTime(timeStr);
    } else {
      throw new Error(`Unsupported time tag: ${tag}`);
    }
  };

  public static parseSubjectPublicKeyInfo = (
    data: Buffer,
  ): ISubjectPublicKeyInfo => {
    const elements = ExtensionParsers.ensureSequenceLength(
      data,
      2,
      ExtensionParsers.parseSubjectPublicKeyInfo.name,
    );

    // First element: algorithm identifier
    const algorithm = this.parseAlgorithmIdentifier(elements[0].content);

    // Second element: subjectPublicKey as a BIT STRING
    const { bits: subjectPublicKey } = decodeBitString(elements[1].content, 0);

    return { algorithm, subjectPublicKey };
  };

  public static parseAlgorithmIdentifier = (
    data: Buffer,
  ): IAlgorithmIdentifier => {
    // Decode the DER sequence representing the AlgorithmIdentifier
    const { elements } = decodeSequence(data, 0);

    // The first element should be the OBJECT IDENTIFIER for the algorithm
    const oidElement = elements[0];
    const { oid } = decodeObjectIdentifier(oidElement.content, 0);

    // If there's a second element, use it as parameters; otherwise, parameters are undefined
    const parameters = elements.length > 1 ? elements[1].content : undefined;

    return {
      algorithm: oid,
      parameters,
    };
  };
  public static parseBasicConstraints = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    const { elements: bcElements } = decodeSequence(extnValue, 0);
    let cA = false;
    let pathLenConstraint: number | undefined = undefined;
    let index = 0;

    if (bcElements.length > index && bcElements[index].tag === DERTag.BOOLEAN) {
      const { value: caValue } = decodeInteger(bcElements[index].content, 0);
      cA = caValue[0] !== 0;
      index++;
    }
    if (bcElements.length > index && bcElements[index].tag === DERTag.INTEGER) {
      const { value: plcValue } = decodeInteger(bcElements[index].content, 0);
      pathLenConstraint = plcValue.readUInt8(0);
      index++;
    }
    return { cA, pathLenConstraint };
  };

  public static parseKeyUsage(
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData {
    // Decode the BIT STRING from the extension value
    const { bits } = decodeBitString(extnValue, 0);

    // Define bit-to-usage mapping as per RFC 5280
    const bitUsageMapping = [
      'digitalSignature',
      'nonRepudiation',
      'keyEncipherment',
      'dataEncipherment',
      'keyAgreement',
      'keyCertSign',
      'cRLSign',
      'encipherOnly',
      'decipherOnly',
    ];

    // Initialize the ParsedKeyUsage object with false values
    const keyUsage: ParsedKeyUsage = {
      digitalSignature: false,
      nonRepudiation: false,
      keyEncipherment: false,
      dataEncipherment: false,
      keyAgreement: false,
      keyCertSign: false,
      cRLSign: false,
      encipherOnly: false,
      decipherOnly: false,
    };

    // Iterate over the bits and set corresponding flags
    for (let byteIndex = 0; byteIndex < bits.length; byteIndex++) {
      const byte = bits[byteIndex];
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        const bitPosition = byteIndex * 8 + bitIndex;

        // Check if the bit is set and within the defined mapping
        if (
          byte & (1 << (7 - bitIndex)) &&
          bitPosition < bitUsageMapping.length
        ) {
          const usage = bitUsageMapping[bitPosition];
          if (usage) {
            keyUsage[usage as keyof ParsedKeyUsage] = true;
          }
        }
      }
    }

    return keyUsage;
  }

  public static parseSubjectAltName(
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData {
    const { elements } = decodeSequence(extnValue, 0);

    if (!elements || !Array.isArray(elements)) {
      throw new ClientError(
        'Invalid SubjectAltName extension: Expected a sequence of GeneralNames.',
        'PARSE_ERROR',
      );
    }

    // Initialize all required fields for SubjectAltName
    const parsedNames: SubjectAltName = {
      names: [],
      dnsNames: [],
      ipAddresses: [],
      emailAddresses: [],
      uris: [],
    };

    for (const elem of elements) {
      const tagClass = elem.tag & 0xc0;
      const tagNumber = elem.tag & 0x1f;

      if (tagClass === TAG_CLASS_CONTEXT_SPECIFIC) {
        switch (tagNumber) {
          case 2: // DNSName
            parsedNames.dnsNames!.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            // Optionally, also add to the general names array if desired
            parsedNames.names.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            break;
          case 7: // IPAddress
            parsedNames.ipAddresses!.push(this.parseIPAddress(elem.content));
            parsedNames.names.push(this.parseIPAddress(elem.content));
            break;
          case 1: // RFC822Name (email)
            parsedNames.emailAddresses!.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            parsedNames.names.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            break;
          case 6: // URI
            parsedNames.uris!.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            parsedNames.names.push(
              elem.content.toString(BinaryToTextEncoding.UTF_8),
            );
            break;
          default:
            console.warn(
              `Unsupported GeneralName type: Class=${tagClass}, Number=${tagNumber}. Skipping.`,
            );
            break;
        }
      } else {
        console.warn(
          `Unsupported GeneralName class: Class=${tagClass}. Skipping.`,
        );
      }
    }

    return parsedNames;
  }

  private static parseIPAddress = (data: Buffer): string => {
    if (data.length === 4) {
      // IPv4
      return Array.from(data).join('.');
    } else if (data.length === 16) {
      // IPv6
      const hex = data.toString(BinaryToTextEncoding.HEX);
      return (
        hex.match(/.{1,4}/g)?.join(':') ||
        data.toString(BinaryToTextEncoding.HEX)
      );
    } else {
      // Unknown IP length
      return data.toString(BinaryToTextEncoding.HEX);
    }
  };

  public static parseExtendedKeyUsage = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    const { elements } = decodeSequence(extnValue, 0);
    const purposes: string[] = [];

    for (const elem of elements) {
      const oid = decodeObjectIdentifier(elem.content, 0).oid;
      purposes.push(oid);
    }

    return { purposes };
  };

  public static parseSubjectKeyIdentifier = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    // Directly use the OCTET STRING as the key identifier.
    return { keyIdentifier: extnValue };
  };

  public static parseAuthorityKeyIdentifier = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    const { elements } = decodeSequence(extnValue, 0);
    let keyIdentifier: Buffer | undefined = undefined;

    // AuthorityKeyIdentifier is a SEQUENCE with optional fields.
    for (const elem of elements) {
      // Look for the keyIdentifier field which is typically [0] EXPLICIT.
      const tagClass = elem.tag & 0xc0;
      const tagNumber = elem.tag & 0x1f;
      if (tagClass === 0x80 && tagNumber === 0) {
        keyIdentifier = elem.content;
      }
      // Additional parsing for authorityCertIssuer and authorityCertSerialNumber can be added here.
    }

    return { keyIdentifier: keyIdentifier || Buffer.alloc(0) };
  };

  public static parseCRLDistributionPoints = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    const { elements: dpElements } = decodeSequence(extnValue, 0);
    const distributionPoints: string[] = [];

    // Iterate over each DistributionPoint
    for (const dpElem of dpElements) {
      const { elements: dpFields } = decodeSequence(dpElem.content, 0);

      // Look for the distributionPoint field with context-specific tag [0]
      for (const field of dpFields) {
        if ((field.tag & 0xc0) === 0xa0) {
          // context-specific [0]
          // distributionPoint field found
          const { elements: dpNameElements } = decodeSequence(field.content, 0);

          // Check if the first element is fullName ([0] choice)
          const firstElem = dpNameElements[0];
          if ((firstElem.tag & 0xc0) === 0xa0) {
            // fullName is expected to be a sequence of GeneralName entries
            const { elements: fullNameElements } = decodeSequence(
              firstElem.content,
              0,
            );

            // For each GeneralName, attempt to extract a DNSName as a simple example
            for (const gn of fullNameElements) {
              const tagClass = gn.tag & 0xc0;
              const tagNumber = gn.tag & 0x1f;
              if (tagClass === TAG_CLASS_CONTEXT_SPECIFIC && tagNumber === 2) {
                // [2] DNSName
                distributionPoints.push(
                  gn.content.toString(BinaryToTextEncoding.UTF_8),
                );
              }
              if (tagClass === TAG_CLASS_CONTEXT_SPECIFIC && tagNumber === 6) {
                // [6] URI
                distributionPoints.push(
                  gn.content.toString(BinaryToTextEncoding.UTF_8),
                );
              }
              if (tagClass === TAG_CLASS_CONTEXT_SPECIFIC && tagNumber === 7) {
                // [7] IPAddress
                distributionPoints.push(this.parseIPAddress(gn.content));
              }
            }
          }
        }
      }
    }

    return { distributionPoints };
  };

  public static parseAuthorityInfoAccess = (
    extnValue: Buffer,
    critical: boolean,
  ): ParsedExtensionData => {
    const { elements: aiaElements } = decodeSequence(extnValue, 0);
    const accessDescriptions: { method: string; location: string }[] = [];

    for (const aiaElem of aiaElements) {
      // Each aiaElem is an AccessDescription SEQUENCE
      const { elements: adElements } = decodeSequence(aiaElem.content, 0);
      if (adElements.length !== 2) {
        continue; // Malformed AccessDescription, skip or handle error.
      }

      // First element: accessMethod (OBJECT IDENTIFIER)
      const method = decodeObjectIdentifier(adElements[0].content, 0).oid;

      // Second element: accessLocation (GeneralName)
      const locationElem = adElements[1];
      let location = '';

      // Attempt to decode a DNSName as an example
      const tagClass = locationElem.tag & 0xc0;
      const tagNumber = locationElem.tag & 0x1f;
      if (tagClass === 0x80 && tagNumber === 2) {
        // [2] DNSName
        location = locationElem.content.toString(BinaryToTextEncoding.UTF_8);
      } else {
        // For other GeneralName types, you could handle accordingly
        location = locationElem.content.toString(BinaryToTextEncoding.UTF_8); // Fallback
      }

      accessDescriptions.push({ method, location });
    }

    return { accessDescriptions };
  };

  private static ensureSequenceLength(
    data: Buffer,
    expectedLength: number,
    context: string,
  ): any {
    const { elements } = decodeSequence(data, 0);
    if (elements.length !== expectedLength) {
      throw new Error(
        `Invalid ${context} structure. Expected ${expectedLength} elements.`,
      );
    }
    return elements;
  }

  public static extensionParsers: { [oid: string]: ExtensionParser } = {
    '2.5.29.19': ExtensionParsers.parseBasicConstraints,
    '2.5.29.15': ExtensionParsers.parseKeyUsage,
    '2.5.29.17': ExtensionParsers.parseSubjectAltName,
    '2.5.29.37': ExtensionParsers.parseExtendedKeyUsage,
    '2.5.29.14': ExtensionParsers.parseSubjectKeyIdentifier,
    '2.5.29.35': ExtensionParsers.parseAuthorityKeyIdentifier,
    '2.5.29.31': ExtensionParsers.parseCRLDistributionPoints,
    '2.5.29.32': ExtensionParsers.parseAuthorityInfoAccess,
  };

  public static parseExtensions = (
    extElements: ReturnType<typeof decodeDER>[],
  ): IExtension[] => {
    const extensions: IExtension[] = [];

    for (const extElement of extElements) {
      const { elements } = decodeSequence(extElement.content, 0);
      if (elements.length < 2) {
        throw new ClientError('Invalid extension structure', 'PARSE_ERROR');
      }

      const oid = decodeObjectIdentifier(elements[0].content, 0).oid;
      let critical = false;
      let extnValueIdx = 1;

      if (elements.length === 3) {
        const boolElem = elements[1];
        if (boolElem.tag === DERTag.BOOLEAN) {
          critical = boolElem.content[0] !== 0;
          extnValueIdx = 2;
        }
      }

      const extnValue = elements[extnValueIdx].content;

      // Delegate to a specific parser if available
      const parser = ExtensionParsers.extensionParsers[oid];
      let parsedData: any = undefined;
      if (parser) {
        try {
          parsedData = parser(extnValue, critical);
        } catch (error) {
          // Handle parsing error for this extension gracefully
          console.error(`Error parsing extension ${oid}:`, error);
        }
      } else {
        // For unknown extensions, you might leave parsedData as raw extnValue or perform generic processing
        parsedData = extnValue;
      }

      extensions.push({
        extnID: oid,
        critical,
        extnValue,
        parsedData,
      });
    }

    return extensions;
  };
}
