package com.gtreactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = GtReactNativeModuleImpl.NAME)
class GtReactNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return GtReactNativeModuleImpl.NAME
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun multiply(a: Double, b: Double): Double {
    return GtReactNativeModuleImpl.multiply(a, b)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getNativeLocales(): WritableArray {
    return GtReactNativeModuleImpl.getNativeLocales(reactApplicationContext)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun nativeStoreGet(key: String): String? {
    return GtReactNativeModuleImpl.nativeStoreGet(reactApplicationContext, key)
  }

  @ReactMethod
  fun nativeStoreSet(key: String, value: String) {
    GtReactNativeModuleImpl.nativeStoreSet(reactApplicationContext, key, value)
  }
}