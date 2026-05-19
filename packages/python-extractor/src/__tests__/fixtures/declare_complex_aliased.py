from gt_flask import t, derive as alias_derive, declare_var as alias_declare_var

def get_name():
    return alias_declare_var('Alice') + '!'

def get_gender(variant):
    return 'she' if variant == 1 else 'he'

def get_adjective(variant):
    return 'beautiful' if variant == 1 else alias_declare_var('handsome')

def get_string(variant):
    return t(f'The {alias_derive(get_gender(variant))} is {alias_derive(get_adjective(variant))}')
