# General Translation

The words the libraries in this repo use for what gets translated and how it is rendered. A name in code uses the term for the form it takes.

## Language

**Message**:
A sentence to translate, with its variables and how each one is formatted. It is held as a message tree and its formats, and can also be written as an ICU string or a tagged template.

**Message tree**:
The sentence of a message as data: its text, where each variable goes, its branches and tags, and the message options of each formatted variable. It is the part that is translated and hashed.
_Avoid_: ICU tree

**Formats**:
How each formatted variable of a message is rendered where the message is used, such as a currency, digits or a time zone. Also called its formatting context. It is neither translated nor hashed.
_Avoid_: formatting options

**Message options**:
The part of a variable's format that belongs to the message tree because a translator has to see it, such as currency versus percent, or which date fields are shown.

**ICU string**:
A message written as ICU MessageFormat text.
_Avoid_: ICU message, message (for the string alone)

**Syntax tree**:
What the ICU parser produces from an ICU string. It is never stored.
_Avoid_: ICU tree, message tree

**Variable**:
A named placeholder in a message.

**Values**:
The data that fills a message's variables for one render.
_Avoid_: variables (for the data)

**Content**:
What is stored for one translatable entry, in one data format. A message tree is content; so is an ICU string or JSX.
_Avoid_: message (for content of any format)

**Data format**:
The form content is stored in: an ICU string, an i18next string, a plain string, JSX, or a message tree.
