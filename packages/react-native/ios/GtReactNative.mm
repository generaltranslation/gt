#import "GtReactNative.h"

@implementation GtReactNative {
  NSUserDefaults *_defaults;
}

RCT_EXPORT_MODULE();

- (instancetype)init
{
  if ((self = [super init])) {
    _defaults = [NSUserDefaults standardUserDefaults];
  }
  return self;
}

// Internal implementation methods
- (NSNumber *)multiplyImpl:(double)a b:(double)b {
    return @(a * b);
}

- (NSArray<NSString *> *)getNativeLocalesImpl {
    NSMutableArray<NSString *> *locales = [[NSMutableArray alloc] init];
    
    // Add current locale first
    NSString *currentLocale = [[NSLocale currentLocale] localeIdentifier];
    if (currentLocale) {
        [locales addObject:currentLocale];
    }
    
    // Add preferred languages
    NSArray<NSString *> *preferredLanguages = [NSLocale preferredLanguages];
    for (NSString *language in preferredLanguages) {
        // Avoid duplicates
        if (![locales containsObject:language]) {
            [locales addObject:language];
        }
    }
    
    return [locales copy];
}

- (nullable NSString *)nativeStoreGetImpl:(NSString *)key
{
  if (key == nil) { return nil; }
  return [_defaults stringForKey:key];
}

- (void)nativeStoreSetImpl:(NSString *)key value:(NSString *)value
{
  if (key == nil || value == nil) { return; }
  [_defaults setObject:value forKey:key];
}

#ifdef RCT_NEW_ARCH_ENABLED

// New architecture
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeGtReactNativeSpecJSI>(params);
}

- (NSNumber *)multiply:(double)a b:(double)b {
    return [self multiplyImpl:a b:b];
}

- (NSArray<NSString *> *)getNativeLocales {
    return [self getNativeLocalesImpl];
}

- (NSString *)nativeStoreGet:(NSString *)key {
    return [self nativeStoreGetImpl:key];
}

- (void)nativeStoreSet:(NSString *)key value:(NSString *)value {
    [self nativeStoreSetImpl:key value:value];
}

#else

// Old architecture
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(multiply:(double)a b:(double)b) {
    return [self multiplyImpl:a b:b];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getNativeLocales) {
    return [self getNativeLocalesImpl];
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(nativeStoreGet:(NSString *)key) {
    return [self nativeStoreGetImpl:key];
}

RCT_EXPORT_METHOD(nativeStoreSet:(NSString *)key value:(NSString *)value) {
    [self nativeStoreSetImpl:key value:value];
}

#endif

@end
