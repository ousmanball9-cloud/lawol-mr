with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "r", encoding="utf-8") as f:
    content = f.read()

idx_start = content.find("class PreferencesAvancees(BaseModel):")
idx_end = content.find("class DashboardProfil(BaseModel):")

if idx_start != -1 and idx_end != -1:
    new_section = """class PreferencesAvancees(BaseModel):
    \"\"\"Pr\u00e9f\u00e9rences avanc\u00e9es stock\u00e9es dans profils.metadata['prefs_avancees'].\"\"\"    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)
    pays_favoris: list[PaysEtudes] = Field(default_factory=list)  # pays d'\u00e9tudes pr\u00e9f\u00e9r\u00e9s
    financement_min: Optional[TypeFinancement] = None  # niveau minimal de financement


class PreferencesAvanceesUpdate(BaseModel):
    \"\"\"PATCH /profils/{tel}/preferences \u2014 corps partiel (seuls champs fournis).\"\"\"

    seuil_pertinence: Optional[int] = Field(default=None, ge=0, le=100)


"""
    content = content[:idx_start] + new_section + content[idx_end:]
    with open(r"D:\opencode\lawol-mr\apps\api\app\modules\shared\models.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("NOT FOUND - idx_start:", idx_start, "idx_end:", idx_end)