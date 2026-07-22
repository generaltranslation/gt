/**
 * Golden cases are adapted from the FormatJS parser integration corpus at:
 * https://github.com/formatjs/formatjs/tree/75edf1cd6a7045475bb134daf62c686602c92547/packages/icu-messageformat-parser/integration-tests/test_cases
 * The upstream fixtures are MIT licensed. See ../../THIRD_PARTY_NOTICES.md.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parse, type ParserOptions } from '../index';

type CompatibilityOptions = Omit<ParserOptions, 'locale'> & { locale?: string };
type CompatibilityCase = {
  name: string;
  message: string;
  options: CompatibilityOptions;
  expected: { hash: string } | { error: string };
};

const CASES = [
  {
    name: 'basic_argument_1',
    message: '{a}',
    options: {},
    expected: {
      hash: '27cc6b09eeedcbf374bb6eba3b24cbf628d864e3da542e9f4504bdc6b1793823',
    },
  },
  {
    name: 'basic_argument_2',
    message: 'a {b} \nc',
    options: {},
    expected: {
      hash: 'aebb298a7c87f491d19d24b02e375489c6707b9279aa64d4c1a60f8f78282d0d',
    },
  },
  {
    name: 'date_arg_skeleton_1',
    message: "{0, date, ::yyyy.MM.dd G 'at' HH:mm:ss vvvv}",
    options: {},
    expected: {
      hash: 'c4909a594fff50500a9804ac468ba5d4af3d354d69f546c8a3d7d8a9644e5d12',
    },
  },
  {
    name: 'date_arg_skeleton_2',
    message: "{0, date, ::EEE, MMM d, ''yy}",
    options: {},
    expected: {
      hash: 'f28fae880f81298caffd3f1092806a8d253439aa9b524b83a20efc38c6084474',
    },
  },
  {
    name: 'date_arg_skeleton_3',
    message: '{0, date, ::h:mm a}',
    options: {},
    expected: {
      hash: 'b51ae146107a921ecc0fbca7e71b16634c0cecf40d324c8ea34c1637325e80de',
    },
  },
  {
    name: 'date_arg_skeleton_with_capital_J',
    message: '{0, date, ::J}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: 'c3435eafb6a4e39acecc41edca2cd90b74cd270212d7f166261e05ce3b470f79',
    },
  },
  {
    name: 'date_arg_skeleton_with_capital_JJ',
    message: '{0, date, ::JJ}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: '5ec32aed395608c7a61d7b8e0644a1e057a391b7a29b64c3fffb4793f0d1bf6a',
    },
  },
  {
    name: 'date_arg_skeleton_with_j',
    message: '{0, date, ::j}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: 'b3a82e2e2e6f2ffb5bee1efa09ba21279fbbb5f0e3caa1e2039f22870ed553e2',
    },
  },
  {
    name: 'date_arg_skeleton_with_jj',
    message: '{0, date, ::jj}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: 'f32e25c6d324ef15387aa2d72b6919d141cdda5c6e09c447a014d2c6ecd6dde8',
    },
  },
  {
    name: 'date_arg_skeleton_with_jjj',
    message: '{0, date, ::jjj}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: '337b435bb392aa063c4d82244d7badd1a2b54b0efcb2a2697c48d993b213e8aa',
    },
  },
  {
    name: 'date_arg_skeleton_with_jjjj',
    message: '{0, date, ::jjjj}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: '25e6d784fc7bfded90d3b5eb5f610bdca2052f87967c70f0a9a533b5fabf942c',
    },
  },
  {
    name: 'date_arg_skeleton_with_jjjjj',
    message: '{0, date, ::jjjjj}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: 'f7ca82a9224b1bb20232963911f30608e9141b0a041d6c07f7115b9665a716ce',
    },
  },
  {
    name: 'date_arg_skeleton_with_jjjjjj',
    message: '{0, date, ::jjjjjj}',
    options: {
      locale: 'und-u-hc-h12',
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    },
    expected: {
      hash: '195cb1589e1389c2aae400811294bb6d3354fe38ca910b69b3f0b11b8a5a82d1',
    },
  },
  {
    name: 'double_apostrophes_1',
    message: "a''b",
    options: {},
    expected: {
      hash: '4e4bdc150a8f28968df438b9661ed8735eaeb030613b71a0174b69d94402678f',
    },
  },
  {
    name: 'duplicate_plural_selectors',
    message:
      'You have {count, plural, one {# hot dog} one {# hamburger} one {# sandwich} other {# snacks}} in your lunch bag.',
    options: {},
    expected: { error: 'DUPLICATE_PLURAL_ARGUMENT_SELECTOR' },
  },
  {
    name: 'duplicate_select_selectors',
    message:
      'You have {count, select, one {# hot dog} one {# hamburger} one {# sandwich} other {# snacks}} in your lunch bag.',
    options: {},
    expected: { error: 'DUPLICATE_SELECT_ARGUMENT_SELECTOR' },
  },
  {
    name: 'empty_argument_1',
    message: 'My name is { }',
    options: {},
    expected: { error: 'EMPTY_ARGUMENT' },
  },
  {
    name: 'empty_argument_2',
    message: 'My name is {\n}',
    options: {},
    expected: { error: 'EMPTY_ARGUMENT' },
  },
  {
    name: 'escaped_multiple_tags_1',
    message: "I '<'3 cats. '<a>foo</a>' '<b>bar</b>'",
    options: {},
    expected: {
      hash: '523dcedad0ab96ea7194fbc14af5435eb98d93d27d5fa37ca852292c9c43cd55',
    },
  },
  {
    name: 'escaped_pound_1',
    message:
      "{numPhotos, plural, =0{no photos} =1{one photo} other{'#' photos}}",
    options: {},
    expected: {
      hash: '8e5ba4780ebf7585b750c4ec7850830a477e2ad96a148213d0583aa32bcca00c',
    },
  },
  {
    name: 'expect_arg_format_1',
    message: 'My name is {0, }',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_TYPE' },
  },
  {
    name: 'expect_date_arg_skeleton_whitespace_only',
    message: '{0, date, ::   }',
    options: {},
    expected: { error: 'EXPECT_DATE_TIME_SKELETON' },
  },
  {
    name: 'expect_number_arg_skeleton_double_slash',
    message: '{0, number, ::currency//USD}',
    options: {},
    expected: { error: 'INVALID_NUMBER_SKELETON' },
  },
  {
    name: 'expect_number_arg_skeleton_empty_stem',
    message: '{0, number, ::/USD}',
    options: {},
    expected: {
      hash: 'ebefeb4f1208dff388ef65c85c3ad79b09c97ef9297d76f27be9a2db2eb2e424',
    },
  },
  {
    name: 'expect_number_arg_skeleton_token_1',
    message: '{0, number, ::}',
    options: {},
    expected: { error: 'INVALID_NUMBER_SKELETON' },
  },
  {
    name: 'expect_number_arg_skeleton_token_option_1',
    message: '{0, number, ::currency/}',
    options: {},
    expected: { error: 'INVALID_NUMBER_SKELETON' },
  },
  {
    name: 'expect_number_arg_skeleton_whitespace_only',
    message: '{0, number, ::   }',
    options: {},
    expected: { error: 'INVALID_NUMBER_SKELETON' },
  },
  {
    name: 'expect_number_arg_style_1',
    message: '{0, number, }',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_STYLE' },
  },
  {
    name: 'ignore_tag_number_arg_1',
    message: 'I have <foo>{numCats, number}</foo> cats.',
    options: { ignoreTag: true },
    expected: {
      hash: '18bd54c5432a3b61605dbcb392063e1d5ade8511b339b7d175424e03e76d0c2c',
    },
  },
  {
    name: 'ignore_tags_1',
    message: '<test-tag></test-tag>',
    options: { ignoreTag: true },
    expected: {
      hash: '341e7abd36d1d7d38fc28216ec644624e7770a171046458d71b6e9dc80a3f960',
    },
  },
  {
    name: 'incomplete_nested_message_in_tag',
    message: '<a>{a, plural, other {</a>}}',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'invalid_arg_format_1',
    message: 'My name is {0, foo}',
    options: {},
    expected: { error: 'INVALID_ARGUMENT_TYPE' },
  },
  {
    name: 'invalid_close_tag_1',
    message: '<a></ b>',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'invalid_closing_tag_1',
    message: '<test>a</123>',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'invalid_closing_tag_2',
    message: '<test>a</',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'invalid_tag_1',
    message: '<test! />',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'invalid_tag_2',
    message: '<test / >',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'invalid_tag_3',
    message: '<test foo />',
    options: {},
    expected: { error: 'INVALID_TAG' },
  },
  {
    name: 'left_angle_bracket_1',
    message: 'I <3 cats.',
    options: {},
    expected: {
      hash: 'f8c2566fed3fd814d4e2be2ce6a38051c06b3d632d9f53ecf1c008f10fcbad47',
    },
  },
  {
    name: 'less_than_sign_1',
    message: '< {level, select, A {1} 4 {2} 3 {3} 2{6} 1{12}} hours',
    options: {},
    expected: {
      hash: '57c242939a72fe44148d1ff010db5eaaa1c477be36c4a66ba7c893360552a230',
    },
  },
  {
    name: 'malformed_argument_1',
    message: 'My name is {0!}',
    options: {},
    expected: { error: 'MALFORMED_ARGUMENT' },
  },
  {
    name: 'negative_offset_1',
    message:
      '{c, plural, offset:-2 =-1 { {text} project} other { {text} projects}}',
    options: {},
    expected: {
      hash: '33707a9ae1c592c58e7169525b8d30e08ecad82cf7ed553564a3e909086dea0a',
    },
  },
  {
    name: 'nested_1',
    message:
      '\n    {gender_of_host, select,\n      female {\n        {num_guests, plural, offset:1\n          =0 {{host} does not give a party.}\n          =1 {{host} invites {guest} to her party.}\n          =2 {{host} invites {guest} and one other person to her party.}\n          other {{host} invites {guest} and # other people to her party.}}}\n      male {\n        {num_guests, plural, offset:1\n          =0 {{host} does not give a party.}\n          =1 {{host} invites {guest} to his party.}\n          =2 {{host} invites {guest} and one other person to his party.}\n          other {{host} invites {guest} and # other people to his party.}}}\n      other {\n        {num_guests, plural, offset:1\n          =0 {{host} does not give a party.}\n          =1 {{host} invites {guest} to their party.}\n          =2 {{host} invites {guest} and one other person to their party.}\n          other {{host} invites {guest} and # other people to their party.}}}}\n    ',
    options: {},
    expected: {
      hash: 'd5ac583e27ceefc73517d366c80fce0e52a3ec84143f6d3f97c121fd0e80df1b',
    },
  },
  {
    name: 'nested_tags_1',
    message: 'this is <a>nested <b>{placeholder}</b></a>',
    options: {},
    expected: {
      hash: 'ea9d332ad15e83dfde030369fe60c1dd4943a90a7fa5948494ad5e1ff71a7a68',
    },
  },
  {
    name: 'not_escaped_pound_1',
    message: "'#'",
    options: {},
    expected: {
      hash: '8c9f1f43948dfc60a1260090375e440f8c690941027f716efec6ecdc6f76f777',
    },
  },
  {
    name: 'not_quoted_string_1',
    message: "'aa''b'",
    options: {},
    expected: {
      hash: '9c76f483606e21c03c06b8e5040ee5b7bde3c5acad1e55d6064e9981e4028032',
    },
  },
  {
    name: 'not_quoted_string_2',
    message: "I don't know",
    options: {},
    expected: {
      hash: 'b9a090a0729e8e3b051376b3ba316874325e51b8c1c2942e1bf87668eaf7f7c5',
    },
  },
  {
    name: 'not_self_closing_tag_1',
    message: '< test-tag />',
    options: {},
    expected: {
      hash: '38cffdb2a085a3f4766baa5823079f27f455e9ea491ddc01e281c8e27e594d5c',
    },
  },
  {
    name: 'number_arg_skeleton_2',
    message: '{0, number, :: currency/GBP}',
    options: {},
    expected: {
      hash: 'b34e791c40c7dce4d3e1e8d7aa7e1f895221f4f5c9a742df39af37d9314d8728',
    },
  },
  {
    name: 'number_arg_skeleton_3',
    message: '{0, number, ::currency/GBP compact-short}',
    options: {},
    expected: {
      hash: 'bc4acf4254bee272f7aeda3cc4eb138fb5fe708463f555ea25c5102baae23380',
    },
  },
  {
    name: 'number_arg_style_1',
    message: '{0, number, percent}',
    options: {},
    expected: {
      hash: '4d810180e603b8b8f42716b353e6ad0416b1d48c66e328f0bd8dae2d2a355adb',
    },
  },
  {
    name: 'number_skeleton_1',
    message: '{0, number, ::compact-short currency/GBP}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'e9f25e9488b594af466e6f1b2eccc6ce6676c1eab2189d9339bfbdefeb4e61a6',
    },
  },
  {
    name: 'number_skeleton_10',
    message: '{0, number, ::currency/GBP .00##/@@@ unit-width-full-name}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'e8d4f13e3e18da8e1b714f0a6358a1a4c6df0becc8bd7bd9d492031820dad468',
    },
  },
  {
    name: 'number_skeleton_11',
    message:
      '{0, number, ::measure-unit/length-meter .00##/@@@ unit-width-full-name}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '6c430b1fb731941617c221a6fc2cd42988045e0f04f3be313f219b7f04ab72c9',
    },
  },
  {
    name: 'number_skeleton_12',
    message: '{0, number, ::scientific/+ee/sign-always}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '0dc833e1315c09c06595f1a9b17e9b7d34aed8abcc33024720c5d1832c40e55f',
    },
  },
  {
    name: 'number_skeleton_2',
    message: '{0, number, ::@@#}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'fd00fa0ff4900aa99d221bb40c624d42786881d904fbc0272f72997ae2feecfd',
    },
  },
  {
    name: 'number_skeleton_3',
    message: '{0, number, ::currency/CAD unit-width-narrow}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '210f70edb720b38c0b92d380a834c914ec069ee324f5877214bd53a8a0380aa6',
    },
  },
  {
    name: 'number_skeleton_4',
    message: '{0, number, ::percent .##}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'c57418d9edbacd53d77600b1b66fd5b35195d9b4858281a2b9ad8e8e603d8313',
    },
  },
  {
    name: 'number_skeleton_5',
    message: '{0, number, ::percent .000*}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '7e8d7c5a134191a20c6ec8c32c8f5d7144400221303f60a18da4328759b851b5',
    },
  },
  {
    name: 'number_skeleton_6',
    message: '{0, number, ::percent .0###}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'f602595455719fb90acacbc4209d5683ef6eb764223848166e186ef1adc75278',
    },
  },
  {
    name: 'number_skeleton_7',
    message: '{0, number, ::percent .00/@##}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '54e6aefd90c724af47c585c154ff0d05c8ccdd73b8a1486052df742dab496a27',
    },
  },
  {
    name: 'number_skeleton_8',
    message: '{0, number, ::percent .00/@@@}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: '89348bf0114d46f0339967aee01189d7ed6a2f3bf89936f39b1d4880c78d51ad',
    },
  },
  {
    name: 'number_skeleton_9',
    message: '{0, number, ::percent .00/@@@@*}',
    options: { shouldParseSkeletons: true },
    expected: {
      hash: 'e3e26ba532c61fcd57e50f461fac107f72187b42ca780453b30d8f3f453f6656',
    },
  },
  {
    name: 'number_skeleton_many_tokens',
    message:
      '{0, number, ::compact-short unit-width-narrow notation-scientific}',
    options: {},
    expected: {
      hash: 'a4e8c6450a04cde43e514ff5972dcd3f916e9e8c547318c7770c955a775f6d37',
    },
  },
  {
    name: 'number_skeleton_multiple_spaces',
    message: '{0, number, ::   percent   scale/100   }',
    options: {},
    expected: {
      hash: '2fb9197696fb14131a85c3d2dd82949a27ce4307fd9fd8cde10f3d0fbc042f2a',
    },
  },
  {
    name: 'number_skeleton_trailing_slash',
    message: '{0, number, ::compact-short/}',
    options: {},
    expected: { error: 'INVALID_NUMBER_SKELETON' },
  },
  {
    name: 'number_skeleton_with_tab',
    message: '{0, number, ::currency/USD\tcompact-short}',
    options: {},
    expected: {
      hash: 'f671070c598cb8d6ee48bea27f6676ac1f60445657e958110b0c353823a2ae39',
    },
  },
  {
    name: 'numeric_tag_1',
    message: '<i0>foo</i0>',
    options: {},
    expected: {
      hash: '64fe9536a7ea2b1392012f5635dbe557f4b3462e8a15617d7d79395f7047b611',
    },
  },
  {
    name: 'open_close_tag_1',
    message: '<test-tag></test-tag>',
    options: {},
    expected: {
      hash: '4489800de7d0963ff3cc88c8bf854ed3141e93bcf21a72cc081aa4a947b84954',
    },
  },
  {
    name: 'open_close_tag_2',
    message: '<test-tag>foo</test-tag>',
    options: {},
    expected: {
      hash: 'c58bfe8e649e93c4df755e078f7114b0ea8a15513b2d44a6734e5e5adaba1437',
    },
  },
  {
    name: 'open_close_tag_3',
    message: '<test-tag>foo {0} bar</test-tag>',
    options: {},
    expected: {
      hash: 'e9b56c6b4b14c43a2f244c4487afd4e205517c4bc3aa2f61e1e4cb60eccafd16',
    },
  },
  {
    name: 'open_close_tag_with_args',
    message:
      'I <b>have</b> <foo>{numCats, number} some string {placeholder}</foo> cats.',
    options: {},
    expected: {
      hash: '4adb6f8c24a1f58ae181e51509aa242637218ae32c99639310ff71b1b80e6c8b',
    },
  },
  {
    name: 'open_close_tag_with_nested_arg',
    message:
      '<bold>You have {\n        count, plural,\n        one {<italic>#</italic> apple}\n        other {<italic>#</italic> apples}\n    }.</bold>',
    options: {},
    expected: {
      hash: '8e288d77bcec6bce3a60adbaddd1ca612c4a6c3e1c76ebe87aa96b99f736b9aa',
    },
  },
  {
    name: 'plural_arg_1',
    message:
      '\n    Cart: {itemCount} {itemCount, plural,\n        one {item}\n        other {items}\n    }',
    options: {},
    expected: {
      hash: '12d92a66c19dd88dbc01bbdf580ea2efc19da70dbf4ad1b38ebc9a4620fc9344',
    },
  },
  {
    name: 'plural_arg_2',
    message:
      '\n    You have {itemCount, plural,\n        =0 {no items}\n        one {1 item}\n        other {{itemCount} items}\n    }.',
    options: {},
    expected: {
      hash: 'a2d11eb807960d0d9baad147dbf3a75df93d051faff32d7df4f9a4b9e9b3a3b4',
    },
  },
  {
    name: 'plural_arg_with_escaped_nested_message',
    message:
      "\n    {itemCount, plural,\n        one {item'}'}\n        other {items'}'}\n    }",
    options: {},
    expected: {
      hash: '59f372babb0c0966ee9d58c63b607427e9e9ca065d5a6bf79a6e0995d06eccb3',
    },
  },
  {
    name: 'plural_arg_with_offset_1',
    message:
      'You have {itemCount, plural, offset: 2\n        =0 {no items}\n        one {1 item}\n        other {{itemCount} items}\n    }.',
    options: {},
    expected: {
      hash: '329e98d4c2275b9a005877f31893d5dbbd5485c1d74310726ac9a2b54d1bc9e1',
    },
  },
  {
    name: 'plural_with_number_skeleton',
    message:
      '{0, plural, one {You have {1, number, ::currency/USD}} other {You have {1, number, ::currency/USD}}}',
    options: {},
    expected: {
      hash: '88fefd77685f96228d9306f60b9fba75c1ca65855a0c95dae2223032b8dfc81f',
    },
  },
  {
    name: 'quoted_pound_sign_1',
    message:
      "You {count, plural, one {worked for '#' hour} other {worked for '#' hours}} today.",
    options: {},
    expected: {
      hash: '0be3c7ddf1e98d11f2a16b3c53f5416cede461daeef5d60b0cb82755141d52fd',
    },
  },
  {
    name: 'quoted_pound_sign_2',
    message:
      "You {count, plural, one {worked for '# hour} other {worked for '# hours}} today.",
    options: {},
    expected: {
      hash: 'c5f5aef5b02f9326454849761ac19a3ca039364da6de19a3bdf8412a086ebfc2',
    },
  },
  {
    name: 'quoted_string_1',
    message: "'{a''b}'",
    options: {},
    expected: {
      hash: '17d88b72da1ac2ced68d6905f24aeeaa1038e8eb0a6da2012f5e2f40b1f9fbab',
    },
  },
  {
    name: 'quoted_string_2',
    message: "'}a''b{'",
    options: {},
    expected: {
      hash: 'c2593330a21f83560f42f1c2ae765e08ff16212dff772d88fce8521c92cdd9f1',
    },
  },
  {
    name: 'quoted_string_3',
    message: "aaa'{'",
    options: {},
    expected: {
      hash: 'bedca27322e544468555879398f653d5ccb174852b4bd052786c7d608bddc441',
    },
  },
  {
    name: 'quoted_string_4',
    message: "aaa'}'",
    options: {},
    expected: {
      hash: '149fecf8cb4cad57a427f1b6d69e8e2df8c5b5194e68053edab8450d0ed46314',
    },
  },
  {
    name: 'quoted_string_5',
    message: "This '{isn''t}' obvious",
    options: {},
    expected: {
      hash: '1a25bcef0e79498599cfd8068228e9b041da64548f6f1b90fbcfb1b3b234bd52',
    },
  },
  {
    name: 'quoted_tag_1',
    message: "'<a>",
    options: {},
    expected: {
      hash: '966aa5a19519cf0607156f815116b1ff35b250ac9a12e60a83032082616954a2',
    },
  },
  {
    name: 'select_arg_1',
    message:
      '\n    {gender, select,\n        male {He}\n        female {She}\n        other {They}\n    } will respond shortly.',
    options: {},
    expected: {
      hash: 'e8c62dcee646f05b3726fcb673a434047736ebf3894ef9ac57523da850d75400',
    },
  },
  {
    name: 'select_arg_with_nested_arguments',
    message:
      '\n    {taxableArea, select,\n        yes {An additional {taxRate, number, percent} tax will be collected.}\n        other {No taxes apply.}\n    }\n    ',
    options: {},
    expected: {
      hash: '56e0af50c92c016f4dfb9e8d21d773cf1a8c6457a9e27fc807adba90a238b0ce',
    },
  },
  {
    name: 'select_with_number_skeleton',
    message:
      '{0, select, female {{1, number, ::currency/EUR} paid} male {{1, number, ::currency/EUR} paid} other {{1, number, ::currency/EUR} paid}}',
    options: {},
    expected: {
      hash: 'c8e3e3581e1aec9da2055a4425434d52ce466f0782079ac070c8b01224d654c8',
    },
  },
  {
    name: 'selectordinal_1',
    message:
      '{floor, selectordinal, =0{ground} one{#st} two{#nd} few{#rd} other{#th}} floor',
    options: {},
    expected: {
      hash: '355f6ba432f6caa6fe83c215fa04215d1c0b32e9e2ccc490c940c269954908c1',
    },
  },
  {
    name: 'self_closing_tag_1',
    message: '<test-tag />',
    options: {},
    expected: {
      hash: 'c7ee383dfe4d31f6f23226c423f315eee1ea83041adcc8ff3a9d13a8125a4dd4',
    },
  },
  {
    name: 'self_closing_tag_2',
    message: '<test-tag/>',
    options: {},
    expected: {
      hash: '26efb30e277f0708493f4008772396c00cc0cbc15934b5e5454b8c4e09764c0d',
    },
  },
  {
    name: 'simple_argument_1',
    message: 'My name is {0}',
    options: {},
    expected: {
      hash: 'd26be4737f5a773eb8bce42beffb46494cea8f9a18b8b8684a3efb070981a44e',
    },
  },
  {
    name: 'simple_argument_2',
    message: 'My name is { name }',
    options: {},
    expected: {
      hash: 'a717add0b3b79b6747609803a282e56330eb25375713bd814d5fd2c7848e520c',
    },
  },
  {
    name: 'simple_date_and_time_arg_1',
    message:
      'Your meeting is scheduled for the {dateVal, date} at {timeVal, time}',
    options: {},
    expected: {
      hash: 'b2f2d036d1cf1f20f618d154bc2583dc124bd89dc006c521699fc08e9a293884',
    },
  },
  {
    name: 'simple_number_arg_1',
    message: 'I have {numCats, number} cats.',
    options: {},
    expected: {
      hash: '2ef90b0862b584b3a121e5f6745c27100edfb1f3e5c377011f70ebee26f016b5',
    },
  },
  {
    name: 'treat_unicode_nbsp_as_whitespace',
    message:
      '\n    {gender, select,\n    ‎male {\n        {He}}\n    ‎female {\n        {She}}\n    ‎other{\n        {They}}}\n    ',
    options: {},
    expected: {
      hash: 'fb6af1ced8efe61c9c92e5df451f68699abb824b9332b5ceebef72dfc90a2a0d',
    },
  },
  {
    name: 'trivial_1',
    message: 'a',
    options: {},
    expected: {
      hash: 'd394ab9fad7925da4df2bf70a98774d861088249c882d9929f28cc9dc6022c50',
    },
  },
  {
    name: 'trivial_2',
    message: '中文',
    options: {},
    expected: {
      hash: '75d7da71c52ac1e12dd170833f6ee4c621ff662dd2832315b5ff067b747b36e1',
    },
  },
  {
    name: 'unclosed_argument_1',
    message: 'My name is { 0',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'unclosed_argument_2',
    message: 'My name is { ',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'unclosed_number_arg_1',
    message: '{0, number',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'unclosed_number_arg_2',
    message: '{0, number, percent',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'unclosed_number_arg_3',
    message: '{0, number, ::percent',
    options: {},
    expected: { error: 'EXPECT_ARGUMENT_CLOSING_BRACE' },
  },
  {
    name: 'unclosed_quote_in_number_arg',
    message: "{0, number, 'unclosed}",
    options: {},
    expected: { error: 'UNCLOSED_QUOTE_IN_ARGUMENT_STYLE' },
  },
  {
    name: 'unclosed_quoted_string_1',
    message: "a '{a{ {}{}{} ''bb",
    options: {},
    expected: {
      hash: '1f5ea03104ce5cbc62b56cbefd620302da3759ebc5a4b8fa7c5844ca1efbe2e0',
    },
  },
  {
    name: 'unclosed_quoted_string_2',
    message: "a 'a {}{}",
    options: {},
    expected: { error: 'EMPTY_ARGUMENT' },
  },
  {
    name: 'unclosed_quoted_string_3',
    message: "a '{a{ {}{}{}}}''' \n {}",
    options: {},
    expected: { error: 'EMPTY_ARGUMENT' },
  },
  {
    name: 'unclosed_quoted_string_4',
    message: "You have '{count'",
    options: {},
    expected: {
      hash: '9b224acfe32e085776224d27ca11cd9fa6e79bf08ef1fd1d4f13395cad7f341b',
    },
  },
  {
    name: 'unclosed_quoted_string_5',
    message: "You have '{count",
    options: {},
    expected: {
      hash: '82f04beda7af2295018aafe2d957319289ac75d1d76921bcadec96163a936522',
    },
  },
  {
    name: 'unclosed_quoted_string_6',
    message: "You have '{count}",
    options: {},
    expected: {
      hash: '8f5723c019a9ec4dd9df15a8df58a03f959cf2cd828f0301cf6e120215d8b62a',
    },
  },
  {
    name: 'unclosed_quoted_string_7',
    message: "You have '{count} {thing}",
    options: {},
    expected: {
      hash: '1d841735e752f174975fa62ee2e176454dd5e2ab32fe1c1c3e9de4ce917dbec1',
    },
  },
  {
    name: 'unescaped_string_literal_1',
    message: '}',
    options: {},
    expected: {
      hash: 'e560a82fb4121d1c952de29e930c42b188677270ecc481cec3329117c8183f30',
    },
  },
  {
    name: 'unmatched_open_close_tag_1',
    message: '<a></b>',
    options: {},
    expected: { error: 'UNMATCHED_CLOSING_TAG' },
  },
  {
    name: 'unmatched_open_close_tag_2',
    message: '<a></ab>',
    options: {},
    expected: { error: 'UNMATCHED_CLOSING_TAG' },
  },
  {
    name: 'uppercase_tag_1',
    message: 'this is <a>nested <Button>{placeholder}</Button></a>',
    options: {},
    expected: {
      hash: '8b89f6c9c1ce8aa91c9c99aa1483ee2e576210c72c3288666ddd0dd6e3b6ccd3',
    },
  },
] satisfies CompatibilityCase[];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)])
  );
}

function hash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function normalizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.startsWith('Number skeleton') ||
    message.startsWith('Invalid number skeleton')
  ) {
    return 'INVALID_NUMBER_SKELETON';
  }
  return message.split(' at line ')[0];
}

describe('FormatJS parser compatibility corpus', () => {
  it.each(CASES)('$name', ({ message, options, expected }) => {
    const parserOptions: ParserOptions = {
      captureLocation: true,
      requiresOtherClause: false,
      shouldParseSkeletons: false,
      ...options,
      ...(options.locale ? { locale: new Intl.Locale(options.locale) } : {}),
    };

    if ('error' in expected) {
      expect(() => parse(message, parserOptions)).toThrow();
      try {
        parse(message, parserOptions);
      } catch (error) {
        expect(normalizeError(error)).toBe(expected.error);
      }
      return;
    }

    expect(hash(parse(message, parserOptions))).toBe(expected.hash);
  });
});
