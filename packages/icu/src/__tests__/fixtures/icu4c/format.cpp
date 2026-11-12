// Formats each `pattern<TAB>value` row with ICU4C's MessageFormat in en_US,
// UTC, and prints the row with the result appended. The arguments are `n`,
// the value as a number, `s`, the value as a string, and `d`, a fixed date.
#include <unicode/msgfmt.h>
#include <unicode/timezone.h>
#include <fstream>
#include <iostream>
#include <string>
using namespace icu;

int main(int argc, char **argv) {
  TimeZone::adoptDefault(TimeZone::createTimeZone("UTC"));
  const UDate date = 1588807805123.0; // 2020-05-06T23:30:05.123Z
  std::ifstream in(argv[1]);
  std::string line;
  while (std::getline(in, line)) {
    const size_t tab = line.find('\t');
    const std::string pattern = line.substr(0, tab);
    const std::string value = line.substr(tab + 1);
    double number = 0;
    try { number = std::stod(value); } catch (...) {}
    UErrorCode status = U_ZERO_ERROR;
    MessageFormat format(UnicodeString::fromUTF8(pattern), Locale("en_US"), status);
    std::string result;
    if (U_FAILURE(status)) {
      result = std::string("PARSE ERROR ") + u_errorName(status);
    } else {
      UnicodeString names[] = {"d", "n", "s"};
      Formattable args[] = {Formattable(date, Formattable::kIsDate),
                            Formattable(number),
                            Formattable(UnicodeString::fromUTF8(value))};
      UnicodeString out;
      format.format(names, args, 3, out, status);
      if (U_FAILURE(status)) result = std::string("FORMAT ERROR ") + u_errorName(status);
      else out.toUTF8String(result);
    }
    std::cout << pattern << "\t" << value << "\t" << result << "\n";
  }
}
