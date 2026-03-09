import os
from gt_flask import t
from flask import Flask

app = Flask(__name__)
greeting = t("Hello from Flask")
path = os.path.join("/tmp", "file.txt")
