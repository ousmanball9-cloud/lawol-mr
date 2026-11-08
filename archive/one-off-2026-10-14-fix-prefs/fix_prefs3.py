with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

old = """class PreferencesAvancees(BaseModel):
    """Préférences avancées stockées dans profils.metadata['prefs_avancees']."""    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'études préférés
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement"""

new = """class PreferencesAvancees(BaseModel):
    """Préférences avancées stockées dans profils.metadata['prefs_avancees']."""
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'études préférés
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement"""

if old in content:
    content = content.replace(old, new)
    with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("NOT FOUND")
    idx = content.find("class PreferencesAvancees(BaseModel):")
    if idx != -1:
        print(repr(content[idx:idx+300]))