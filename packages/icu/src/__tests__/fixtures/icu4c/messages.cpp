// Formats each `id<TAB>locale<TAB>message<TAB>values` row with ICU4C's
// MessageFormat in UTC and prints `id<TAB>state<TAB>result`, where the state
// is `ok` or the step that failed. messages.mjs writes the rows and reads the
// results.
//
// values: `name:type:value` joined by U+001F. The type is n for a double, i
// for an int64, s for a string and d for a date in epoch milliseconds. A
// field spells a tab, a newline and a backslash as \t, \n and \\.
#include <unicode/msgfmt.h>
#include <unicode/timezone.h>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>
using namespace icu;

static std::string unescape(const std::string &in) {
  std::string out;
  for (size_t i = 0; i < in.size(); i++) {
    if (in[i] == '\\' && i + 1 < in.size()) {
      char c = in[++i];
      out += c == 't' ? '\t' : c == 'n' ? '\n' : c == 'r' ? '\r' : c;
    } else out += in[i];
  }
  return out;
}
static std::string escape(const std::string &in) {
  std::string out;
  for (char c : in) {
    if (c == '\t') out += "\\t"; else if (c == '\n') out += "\\n";
    else if (c == '\r') out += "\\r"; else if (c == '\\') out += "\\\\";
    else out += c;
  }
  return out;
}
static std::vector<std::string> split(const std::string &s, char sep) {
  std::vector<std::string> parts; std::string cur;
  for (char c : s) { if (c == sep) { parts.push_back(cur); cur.clear(); } else cur += c; }
  parts.push_back(cur); return parts;
}

int main(int argc, char **argv) {
  TimeZone::adoptDefault(TimeZone::createTimeZone("UTC"));
  std::ifstream in(argv[1]);
  std::string line;
  while (std::getline(in, line)) {
    std::vector<std::string> cols = split(line, '\t');
    if (cols.size() < 4) continue;
    const std::string id = cols[0], locale = cols[1];
    const std::string pattern = unescape(cols[2]);
    std::vector<UnicodeString> names; std::vector<Formattable> values;
    if (!cols[3].empty()) for (const std::string &arg : split(cols[3], '\x1f')) {
      size_t a = arg.find(':'), b = arg.find(':', a + 1);
      std::string name = arg.substr(0, a), type = arg.substr(a + 1, b - a - 1);
      std::string value = unescape(arg.substr(b + 1));
      names.push_back(UnicodeString::fromUTF8(name));
      if (type == "n") values.push_back(Formattable(std::stod(value)));
      else if (type == "i") values.push_back(Formattable((int64_t)std::stoll(value)));
      else if (type == "d") values.push_back(Formattable(std::stod(value), Formattable::kIsDate));
      else values.push_back(Formattable(UnicodeString::fromUTF8(value)));
    }
    UErrorCode status = U_ZERO_ERROR;
    UParseError parseError;
    MessageFormat format(UnicodeString::fromUTF8(pattern), Locale::createFromName(locale.c_str()), parseError, status);
    std::string state = "ok", result;
    if (U_FAILURE(status)) { state = "parse-error"; result = u_errorName(status); }
    else {
      UnicodeString out;
      format.format(names.data(), values.data(), (int32_t)names.size(), out, status);
      if (U_FAILURE(status)) { state = "format-error"; result = u_errorName(status); }
      else out.toUTF8String(result);
    }
    std::cout << id << "\t" << state << "\t" << escape(result) << "\n";
  }
}
