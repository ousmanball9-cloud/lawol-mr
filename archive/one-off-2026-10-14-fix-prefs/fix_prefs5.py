import re

with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

# Fix: add newline after docstring in PreferencesAvancees class
# The pattern matches the line where docstring and first field are on same line
content = content.replace(
    'class PreferencesAvancees(BaseModel):\n    """Préférences avancées stockées dans profils.metadata[\'prefs_avancees'].""\"    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)',
    'class PreferencesAvancees(BaseModel):\n    """Préférences avancées stockées dans profils.metadata[\'prefs_avancees'].""\"\n    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)'
)

with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
    f.write(content)

print("DONE")