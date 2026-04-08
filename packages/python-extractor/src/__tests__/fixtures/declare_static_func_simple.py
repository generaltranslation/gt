from gt_flask import t, declare_static

def get_name():
    return '!'

a = t(f"Hello, {declare_static(get_name())}!")
