import os
import re

directory = r'c:\VikasSchool\force-app\main\default\classes'
count = 0

for filename in os.listdir(directory):
    if filename.endswith('.cls'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Regex to find Security.stripInaccessible(..., [SELECT ... WITH SECURITY_ENFORCED ...])
        # We'll use a simpler approach: if a line contains Security.stripInaccessible AND WITH SECURITY_ENFORCED
        # we will replace WITH SECURITY_ENFORCED with an empty string, being careful to only replace it if it's part of the query.
        
        lines = content.split('\n')
        new_lines = []
        modified = False
        
        for line in lines:
            if 'stripInaccessible' in line and 'WITH SECURITY_ENFORCED' in line:
                # Replace ' WITH SECURITY_ENFORCED' with '' (ignoring case if necessary, but it's usually uppercase)
                new_line = line.replace(' WITH SECURITY_ENFORCED', '')
                new_lines.append(new_line)
                modified = True
                count += 1
            else:
                new_lines.append(line)
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write('\n'.join(new_lines))
            print(f"Modified {filename}")

print(f"Total lines modified: {count}")
