package com.gtreactnative

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = GtReactNativeModuleImpl.NAME)
class GtReactNativeModule(reactContext: ReactApplicationContext) :
  NativeGtReactNativeSpec(reactContext) {

  override fun getName(): String {
    return GtReactNativeModuleImpl.NAME
  }

  override fun multiply(a: Double, b: Double): Double {
    return GtReactNativeModuleImpl.multiply(a, b)
  }

  override fun getNativeLocales(): WritableArray {
    return GtReactNativeModuleImpl.getNativeLocales(reactApplicationContext)
  }

  override fun nativeStoreGet(key: String): String? {
    return GtReactNativeModuleImpl.nativeStoreGet(reactApplicationContext, key)
  }

  override fun nativeStoreSet(key: String, value: String) {
    GtReactNativeModuleImpl.nativeStoreSet(reactApplicationContext, key, value)
  }
}