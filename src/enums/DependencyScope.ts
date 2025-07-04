export enum DependencyScope {
  /**
   * The provider can be shared across multiple classes. The provider lifetime
   * is strictly tied to the application lifecycle. Once the application has
   * bootstrapped, all providers have been instantiated.
   */
  SINGLETON = 0,
  /**
   * A new private instance of the provider is instantiated for every use
   */
  TRANSIENT = 1,
  /**
   * A new instance is instantiated for each request processing pipeline
   */
  REQUEST = 2,
}
