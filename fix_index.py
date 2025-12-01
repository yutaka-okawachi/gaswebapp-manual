
lines_to_delete_start = 892
lines_to_delete_end = 1088
file_path = r'c:\Users\okawa\gaswebapp-manual\src\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Adjust for 0-based index
start_idx = lines_to_delete_start - 1
end_idx = lines_to_delete_end - 1

# Check content before deleting to be sure
print(f"Line {lines_to_delete_start}: {lines[start_idx].strip()}")
print(f"Line {lines_to_delete_end}: {lines[end_idx].strip()}")

if "ALL_BRASS" in lines[start_idx] and "曲名を選択" in lines[end_idx]:
    new_lines = lines[:start_idx] + lines[end_idx+1:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully deleted lines.")
else:
    print("Verification failed. Lines do not match expected content.")
