import urllib.request
import urllib.parse
import ssl

def trigger_gas_export():
    # 正しいURL（README.md から取得）
    base_url = "https://script.google.com/macros/s/AKfycbzsgiXGZ3ptAGqR-qMDR26tRNI235IYUVBox-quohfqvNlnkxGSqNb9yY8DiD41JB8qWA/exec"
    token = "e58abb2e-1ab9-4cde-b1ee-5ec4dcaa9424"
    action = "exportDicExperimental"
    
    params = urllib.parse.urlencode({
        "action": action,
        "token": token
    })
    url = f"{base_url}?{params}"
    
    print(f"Triggering Action: {action}")
    print(f"URL: {base_url}?action={action}&token=********")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"Status: {response.status}")
            body = response.read().decode('utf-8')
            print(f"Response Body: {body}")
            if "\"success\":true" in body.replace(" ", ""):
                print("✓ Success!")
            else:
                print("✗ Failed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    trigger_gas_export()
