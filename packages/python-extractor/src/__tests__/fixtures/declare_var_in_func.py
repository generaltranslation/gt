from gt_flask import t, derive, declare_var

def get_name():
    return declare_var(name) + '!'

a = t(f"Hello, {derive(get_name() if True else 'fallback')}!")
