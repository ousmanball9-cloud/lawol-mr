with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

# Find the exact position of the problematic line
idx = content.find("Préférences avancées stockées")
if idx != -1:
    end_idx = content.find("\n", idx)
    line = content[idx:end_idx]
    print("LINE:", repr(line))
    
    if "seuil_pertinence" in line:
        print("FIELD ON SAME LINE - NEEDS FIX")
        quote_end = line.find('"""')
        if quote_end != -1:
            quote_end += 3
            rest = line[quote_end:]
            print("REST:", repr(rest))
            
            before = content[:idx + quote_end]
            after = content[idx + len(line):]
            fixed = before + "\n    " + rest.lstrip()
            
            with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
                f.write(fixed)
            print("FIX APPLIED")
    else:
        print("NOT FOUND")
else:
    print("NOT FOUND - trying alternative search")
    idx2 = content.find("PreferencesAvancees")
    if idx2 != -1:
        print("Found at:", idx2)
        print(repr(content[idx2:idx2+300]))