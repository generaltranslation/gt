package com.gtreactnative

import android.content.Context
import android.os.LocaleList
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray

object GtReactNativeModuleImpl {
  const val NAME = "GtReactNative"

  fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  fun getNativeLocales(reactContext: ReactApplicationContext): WritableArray {
    val locales = Arguments.createArray()
    val seenLocales = mutableSetOf<String>()

    try {
      val localeList = LocaleList.getDefault()
      for (i in 0 until localeList.size()) {
        val locale = localeList.get(i)
        val localeString = locale.toLanguageTag()
        if (!seenLocales.contains(localeString)) {
          locales.pushString(localeString)
          seenLocales.add(localeString)
        }
      }
    } catch (e: Exception) {
      // Return empty array on any error
    }

    return locales
  }

  fun nativeStoreGet(reactContext: ReactApplicationContext, key: String): String? {
    val prefs = reactContext.getSharedPreferences("gt_store", Context.MODE_PRIVATE)
    return prefs.getString(key, null)
  }

  fun nativeStoreSet(reactContext: ReactApplicationContext, key: String, value: String) {
    val prefs = reactContext.getSharedPreferences("gt_store", Context.MODE_PRIVATE)
    prefs.edit().putString(key, value).apply()
  }
}