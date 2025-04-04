'use client';

import { listSupportedLocales } from '@generaltranslation/supported-locales';
import { getLocaleProperties } from 'generaltranslation';
import { useState } from 'react';

export default function SupportedLocales() {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter locales based on search query
  const filteredLocales = listSupportedLocales().filter((locale) => {
    const properties = getLocaleProperties(locale);
    const searchLower = searchQuery.toLowerCase();
    return (
      locale.toLowerCase().includes(searchLower) ||
      properties.name.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="my-8">
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-3 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search locales"
        />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-0 list-none">
        {filteredLocales.map((locale) => {
          const properties = getLocaleProperties(locale);
          return (
            <li
              key={locale}
              className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-black dark:text-white transition-transform hover:translate-y-[-2px] hover:shadow-md"
            >
              <div
                className="font-bold font-mono text-lg flex items-center gap-2"
                suppressHydrationWarning
              >
                {locale}
                <span
                  role="img"
                  aria-label={`${properties.name} flag`}
                  suppressHydrationWarning
                >
                  {properties.emoji}
                </span>
              </div>
              <div
                className="mt-1 text-gray-600 dark:text-gray-300"
                suppressHydrationWarning
              >
                {properties.name}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
