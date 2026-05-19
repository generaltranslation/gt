from gt_fastapi import declare_var as alias_declare_var, derive as alias_derive


def get_name():
    return alias_declare_var('Alice') + '!'

def get_gender(variant):
    return 'she' if variant == 1 else 'he'

def get_adjective(variant):
    return 'beautiful' if variant == 1 else alias_declare_var('handsome')
