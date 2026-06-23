with open('src/types/display.ts', 'r') as f:
    content = f.read()

new_type = """
export interface DisplayMedia {
    id: string;
    commerce_id: string;
    name: string;
    type: string;
    url: string;
    storage_path: string;
    size_bytes: number;
    created_at: string;
}

export interface DisplayDevice {
"""

content = content.replace("export interface DisplayDevice {", new_type)

with open('src/types/display.ts', 'w') as f:
    f.write(content)

print("types patched")
