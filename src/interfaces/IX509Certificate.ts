/**
 * Represents a X.509 certificate structure.
 */
export interface IX509Certificate {
  tbsCertificate: ITbsCertificate;
  signatureAlgorithm: IAlgorithmIdentifier;
  signatureValue: Buffer;
}

export interface ITbsCertificate {
  version?: number;
  serialNumber: Buffer;
  signature: IAlgorithmIdentifier;
  issuer: IName;
  validity: IValidity;
  subject: IName;
  subjectPublicKeyInfo: ISubjectPublicKeyInfo;
  issuerUniqueID?: Buffer;
  subjectUniqueID?: Buffer;
  extensions?: IExtension[];
}

export interface IAlgorithmIdentifier {
  algorithm: string; // OID as string
  parameters?: Buffer; // Additional parameters if any
}

export interface IName {
  // For simplicity, represent as a sequence of RDNs.
  rdnSequence: IRelativeDistinguishedName[];
}

export interface IRelativeDistinguishedName {
  attributes: AttributeTypeAndValue[];
}

/**
 * Base interface for AttributeTypeAndValue.
 */
export interface IBaseAttributeTypeAndValue {
  type: string; // OID
  value?: string | number | Buffer;
}

/**
 * Interface for string-based AttributeTypeAndValue.
 */
export interface IStringAttributeTypeAndValue
  extends IBaseAttributeTypeAndValue {
  type: string; // Specific OID
  value: string;
}

/**
 * Interface for integer-based AttributeTypeAndValue.
 */
export interface IIntegerAttributeTypeAndValue
  extends IBaseAttributeTypeAndValue {
  type: string; // Specific OID
  value: number;
}

/**
 * Union type for AttributeTypeAndValue.
 */
export type AttributeTypeAndValue =
  | IStringAttributeTypeAndValue
  | IIntegerAttributeTypeAndValue
  | IBaseAttributeTypeAndValue; // Fallback for other types

export interface IValidity {
  notBefore: Date;
  notAfter: Date;
}

export interface ISubjectPublicKeyInfo {
  algorithm: IAlgorithmIdentifier;
  subjectPublicKey: Buffer; // Raw public key bytes (BIT STRING content)
}

export interface IExtension {
  extnID: string;
  critical: boolean;
  extnValue: Buffer;

  // Optional property to store parsed extension data
  parsedData?: any;
}

export interface BasicConstraints {
  cA: boolean;
  pathLenConstraint?: number;
}

export interface KeyUsage {
  usages: string[]; // Raw key usage strings (e.g., ["digitalSignature", "keyEncipherment"])
}

export interface SubjectAltName {
  names: string[]; // List of subject alternative names
  dnsNames?: string[];
  ipAddresses?: string[];
  emailAddresses?: string[];
  uris?: string[];
}

export interface ExtendedKeyUsage {
  purposes: string[]; // List of extended key usages
}

export interface SubjectKeyIdentifier {
  keyIdentifier: Buffer;
}

export interface AuthorityKeyIdentifier {
  keyIdentifier: Buffer;
  authorityCertIssuer?: string[];
  authorityCertSerialNumber?: Buffer;
}

export interface CRLDistributionPoints {
  distributionPoints: string[];
}

export interface AccessDescription {
  method: string;
  location: string;
}

export interface AuthorityInfoAccess {
  accessDescriptions: AccessDescription[];
}

export type ParsedExtensionData =
  | BasicConstraints
  | ParsedKeyUsage
  | SubjectAltName
  | ExtendedKeyUsage
  | SubjectKeyIdentifier
  | AuthorityKeyIdentifier
  | CRLDistributionPoints
  | AuthorityInfoAccess;

export type ExtensionParser = (
  extnValue: Buffer,
  critical: boolean,
) => ParsedExtensionData;

export interface CertificateOptions {
  subjectName: string;
  validity: IValidity;
  tbsCertificate: ITbsCertificate;
  signAlgorithm: { hashName: string; cryptoAlg: string };
  privateKeyPem: string;
}

export interface ParsedKeyUsage {
  digitalSignature: boolean;
  nonRepudiation: boolean;
  keyEncipherment: boolean;
  dataEncipherment: boolean;
  keyAgreement: boolean;
  keyCertSign: boolean;
  cRLSign: boolean;
  encipherOnly: boolean;
  decipherOnly: boolean;
}
