// src/interfaces/factory.interface.ts

export interface IFactory<T> {
  create(): Promise<T>; // Create a resource
  destroy(client: T): Promise<void>; // Destroy a resource
  validate?(client: T): Promise<boolean>; // Validate a resource
}
