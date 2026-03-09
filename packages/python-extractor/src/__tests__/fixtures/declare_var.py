from gt_flask import t, declare_var

# Basic declare_var
a = t(f"Hello {declare_var(name)}!")

# declare_var with _name kwarg
b = t(f"Hello {declare_var(name, _name='user')}!")
