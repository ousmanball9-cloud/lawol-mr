with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

# The exact old string (with the problematic line)
old = 'class PreferencesAvancees(BaseModel):\n    """Préférences avancées stockées dans profils.metadata[\'prefs_avancees'].""\"    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)'

# The fixed version with newline after docstring
new = 'class PreferencesAvancees(BaseModel):\n    """Préférences avancées stockées dans profils.metadata[\'prefs_avancees'].""\"\n    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)'

if old in content:
    content = content.replace(old, new)
    with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("OLD NOT FOUND")
    # Try to find what's there
    idx = content.find('PreferencesAvancees')
    if idx != -1:
        print("FOUND AT:", idx)
        print(repr(content[idx:idx+200]))