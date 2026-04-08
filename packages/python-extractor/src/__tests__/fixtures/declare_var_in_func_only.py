from gt_flask import t, declare_static, declare_var

def get_name():
    return declare_var(name) + '!'

a = t(f"Hello, {declare_static(get_name())}!")
