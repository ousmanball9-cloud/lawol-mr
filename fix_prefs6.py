with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find and fix the PreferencesAvancees class
for i, line in enumerate(lines):
    if 'class PreferencesAvancees(BaseModel):' in line:
        # Check next line for the docstring+field on same line
        if i + 1 < len(lines) and '"""Préférences avancées stockées' in lines[i+1] and 'seuil_pertinence' in lines[i+1]:
            # Fix: split the docstring and field onto separate lines
            lines[i+1] = lines[i+1].replace(
                '"""Préférences avancées stockées dans profils.metadata[\'prefs_avancees'].""\"    seuil_pertinence',
                '"""Préférences avancées stockées dans profils.metadata[\'prefs_avancees\'].""\"\n    seuil_pertinence'
            )
            break

with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
    f.writelines(lines)

print("DONE")