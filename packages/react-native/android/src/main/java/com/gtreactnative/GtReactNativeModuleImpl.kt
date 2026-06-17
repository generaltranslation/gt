package com.gtreactnative

import android.content.Context
import android.os.Build
import android.os.LocaleList
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import java.util.Locale

object GtReactNativeModuleImpl {
  const val NAME = "GtReactNative"

  fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  fun getNativeLocales(reactContext: ReactApplicationContext): WritableArray {
    val locales = Arguments.createArray()
    val seenLocales = mutableSetOf<String>()

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        // Use LocaleList for API 24+
        val localeList = LocaleList.getDefault()
        for (i in 0 until localeList.size()) {
          val locale = localeList.get(i)
          val localeString = locale.toLanguageTag()
          if (!seenLocales.contains(localeString)) {
            locales.pushString(localeString)
            seenLocales.add(localeString)
          }
        }
      } else {
        // Fallback to single default locale for older Android versions
        val defaultLocale = Locale.getDefault()
        val localeString = defaultLocale.toLanguageTag()
        locales.pushString(localeString)
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