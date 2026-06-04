using UnityEngine;

[RequireComponent(typeof(SpriteRenderer))]
public class Door : MonoBehaviour, IInteractable
{
    [SerializeField] private Color closedColor = new Color(0.3f, 0.3f, 0.3f);
    [SerializeField] private Color openColor = new Color(0.4f, 1f, 0.4f);
    [SerializeField] private Sprite openSprite;

    [Header("Messages")]
    [SerializeField] private string speakerName = "Sortie";
    [SerializeField, TextArea(2, 5)] private string exitMessage = "Merci d'avoir joué, mon bg, jtm <3";
    [SerializeField, TextArea(2, 5)] private string lockedMessage = "La sortie est verrouillée. Aide d'abord tous les habitants de la zone.";

    private SpriteRenderer spriteRenderer;
    private bool isOpen;

    private void Awake()
    {
        spriteRenderer = GetComponent<SpriteRenderer>();
        spriteRenderer.color = closedColor;
    }

    private void Start()
    {
        if (GameManager.Instance == null)
        {
            Debug.LogWarning("[Door] Pas de GameManager dans la scène — la porte ne pourra pas s'ouvrir.");
            return;
        }
        GameManager.Instance.OnAllNPCsHelped += Open;
    }

    private void OnDestroy()
    {
        if (GameManager.Instance != null)
            GameManager.Instance.OnAllNPCsHelped -= Open;
    }

    public void Open()
    {
        if (isOpen) return;
        isOpen = true;
        spriteRenderer.color = openColor;
        if (openSprite != null) spriteRenderer.sprite = openSprite;
        Debug.Log("[Door] Porte ouverte !");
    }

    // La porte reste toujours "interactable" : on appuie sur E pour avoir un retour
    // (ouverte -> message de sortie, fermée -> message de verrouillage).
    public bool CanInteract() => true;

    public void Interactable()
    {
        // Porte ouverte : on quitte la zone -> écran de fin (message + boutons Rejouer/Menu/Quitter).
        if (isOpen)
        {
            EndScreenUI.Instance.Show(exitMessage);
            return;
        }

        // Porte verrouillée : petit message d'info via la boîte de dialogue (2e appui = ferme).
        bool iOwnTheBox = DialogueBox.Instance.IsOpen && DialogueBox.Instance.CurrentOwner == (object)this;
        if (iOwnTheBox)
        {
            DialogueBox.Instance.Hide();
            return;
        }
        if (!string.IsNullOrEmpty(lockedMessage))
            DialogueBox.Instance.Show(speakerName, lockedMessage, null, this);
    }
}
