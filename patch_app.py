import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace import
content = re.sub(
    r"import {.*?WorkspaceLibrary.*?} from '\./pages/display-hub/WorkspacePlaceholders';",
    r"import { WorkspaceLibrary } from './pages/display-hub/WorkspacePlaceholders';\nimport { WorkspaceMedia } from './pages/display-hub/WorkspaceMedia';",
    content
)

# Replace Route
content = re.sub(
    r"<Route path=\"library\" element={<WorkspaceLibrary />} />",
    r"<Route path=\"library\" element={<WorkspaceMedia />} />",
    content
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("App.tsx patched.")
