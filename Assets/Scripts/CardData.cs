using UnityEngine;

[CreateAssetMenu(fileName = "NewCard", menuName = "Codyssey/Card", order = 0)]
public class CardData : ScriptableObject
{
    [SerializeField] private string displayName = "Nouvelle carte";
    [SerializeField, TextArea(2, 4)] private string description = "Description de la carte.";
    [SerializeField] private string usage = "Usage typique";
    [SerializeField] private Sprite icon;

    public string DisplayName => displayName;
    public string Description => description;
    public string Usage => usage;
    public Sprite Icon => icon;
}
