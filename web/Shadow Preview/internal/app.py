from flask import Flask, request, Response
import os
import ipaddress

app = Flask(__name__)
FLAG = os.environ.get("FLAG", "CTF{dev_flag}")

def is_internal(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_private or addr.is_loopback
    except ValueError:
        return False

@app.get("/flag")
def flag():
    rip = request.remote_addr or ""
    if not is_internal(rip):
        return Response("Forbidden: internal requests only\n", status=403)
    return Response(f"{FLAG}\n", mimetype="text/plain")

@app.get("/")
def index():
    return "internal-admin: ok\n"