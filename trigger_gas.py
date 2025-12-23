import os
import urllib.request
import urllib.parse
import ssl
import sys

def trigger_gas_export():
    # トークンの取得
    token = os.environ.get('GAS_SECRET_TOKEN', '').strip()
    if not token:
        token = "e58abb2e-1ab9-4cde-b1ee-5ec4dcaa9424"
        print("Using hardcoded token.")

    deploy_url = os.environ.get('GAS_DEPLOY_URL', '').strip()
    if not deploy_url:
        deploy_url = "https://script.google.com/macros/s/AKfycbx_0DP-0XmNb9yY8DiD41JB8qWA/exec"
        print("Using hardcoded deploy URL.")

    action = "exportDicExperimental"
    
    # URLの組み立て
    params = urllib.parse.urlencode({
        "action": action,
        "token": token
    })
    # deploy_url に既にクエリパラメータが含まれている可能性を考慮
    separator = "&" if "?" in deploy_url else "?"
    url = f"{deploy_url}{separator}{params}"
    
    print(f"Triggering Action: {action}")
    print(f"Target URL: {deploy_url}{separator}action={action}&token=********")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"Status: {response.status}")
            body = response.read().decode('utf-8')
            print(f"Response Body: {body}")
            if "success\":true" in body.replace(" ", ""):
                print("✓ Success!")
            else:
                print("✗ Failed.")
    except Exception as e:
        print(f"Error triggering GAS: {e}")

if __name__ == "__main__":
    trigger_gas_export()
