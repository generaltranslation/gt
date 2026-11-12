# ICU4C reference output

`icu4c-78.3.tsv` is what ICU4C 78.3 prints for each message, in `en_US` and
UTC. Each row is a message, a value and ICU4C's result, tab-separated. A
result that starts with `PARSE ERROR` or `FORMAT ERROR` is ICU4C rejecting the
message.

The message's arguments are `n`, the value as a number, `s`, the value as a
string, and `d`, the date `2020-05-06T23:30:05.123Z`.

`../../icu4c-conformance.test.ts` formats every row and checks the result
against ICU4C's.

## Regenerating

`format.cpp` reads `message<TAB>value` rows and prints them with the result
appended, so the fixture is its own input:

```sh
c++ -std=c++17 format.cpp $(pkg-config --cflags --libs icu-i18n) -o format
cut -f1,2 icu4c-78.3.tsv > cases.tsv
./format cases.tsv > icu4c-78.3.tsv
```

To add a case, add its `message<TAB>value` row to `cases.tsv` before the last
step.
