#ifdef RCT_NEW_ARCH_ENABLED

#import <GtReactNativeSpec/GtReactNativeSpec.h>
@interface GtReactNative : NSObject <NativeGtReactNativeSpec>

#else

#import <React/RCTBridgeModule.h>
@interface GtReactNative : NSObject <RCTBridgeModule>

#endif

@end
