with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

old = """class PreferencesAvancees(BaseModel):
    \"\"\"Préférences avancées stockées dans profils.metadata['prefs_avancees']."""    villes_exclues: list[Ville] = Field(default_factory=list)
    types_masques: list[TypeOffre] = Field(default_factory=list)
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'études préférés
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement


class PreferencesAvanceesUpdate(BaseModel):
    \"\"\"PATCH /profils/{tel}/preferences — corps partiel (seuls champs fournis).\"\"\"

    villes_exclues: Optional[list[Ville]] = None
    types_masques: Optional[list[TypeOffre]] = None
    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)"""

new = """class PreferencesAvancees(BaseModel):
    \"\"\"Préférences avancées stockées dans profils.metadata['prefs_avancees']."""    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'études préférés
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement


class PreferencesAvanceesUpdate(BaseModel):
    \"\"\"PATCH /profils/{tel}/preferences — corps partiel (seuls champs fournis).\"\"\"

    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)"""

if old in content:
    content = content.replace(old, new)
    with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("NOT FOUND")
    idx = content.find("class PreferencesAvancees(BaseModel):")
    print(repr(content[idx:idx+900]))