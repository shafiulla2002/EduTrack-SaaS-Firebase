import os
import re

directory = r'c:\VikasSchool\force-app\main\default\classes'
count = 0

for filename in os.listdir(directory):
    if filename.endswith('.cls'):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # We need to find "Security.stripInaccessible(" and the matching ")"
        # But a simpler way is to just use regex to find all "WITH SECURITY_ENFORCED" 
        # and remove them IF they are inside a query wrapped by stripInaccessible.
        # Actually, let's just remove ALL "WITH SECURITY_ENFORCED" that are inside a stripInaccessible call.
        # A regex for stripInaccessible(... [SELECT ... WITH SECURITY_ENFORCED ... ] ...)
        
        # Let's replace 'WITH SECURITY_ENFORCED' with '' if it occurs between 'stripInaccessible' and ')'
        
        # A simple state machine to find stripInaccessible blocks and remove WITH SECURITY_ENFORCED inside them.
        new_content = ""
        idx = 0
        modified = False
        
        while idx < len(content):
            target = "Security.stripInaccessible"
            found_idx = content.find(target, idx)
            if found_idx == -1:
                new_content += content[idx:]
                break
            
            # Find the end of this stripInaccessible call. 
            # We count parentheses to find the matching closing parenthesis.
            new_content += content[idx:found_idx]
            idx = found_idx
            
            paren_count = 0
            in_string = False
            string_char = ''
            end_idx = -1
            
            # fast forward to the first '('
            first_paren = content.find('(', idx)
            if first_paren == -1:
                new_content += content[idx:idx+len(target)]
                idx += len(target)
                continue
                
            for i in range(first_paren, len(content)):
                c = content[i]
                if in_string:
                    if c == string_char and content[i-1] != '\\':
                        in_string = False
                else:
                    if c in ["'", '"']:
                        in_string = True
                        string_char = c
                    elif c == '(':
                        paren_count += 1
                    elif c == ')':
                        paren_count -= 1
                        if paren_count == 0:
                            end_idx = i
                            break
            
            if end_idx != -1:
                block = content[idx:end_idx+1]
                # If there's WITH SECURITY_ENFORCED inside this block, remove it (case-insensitive)
                pattern = re.compile(r'\s+WITH\s+SECURITY_ENFORCED', re.IGNORECASE)
                new_block, num_subs = pattern.subn('', block)
                if num_subs > 0:
                    modified = True
                    count += num_subs
                new_content += new_block
                idx = end_idx + 1
            else:
                new_content += content[idx:idx+len(target)]
                idx += len(target)
        
        if modified:
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Modified {filename}")

print(f"Total occurrences removed: {count}")
