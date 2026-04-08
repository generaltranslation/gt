from gt_flask import t, derive

def get_name():
    return '!'

a = t(f"Hello, {derive(get_name())}!")
