using UnityEngine;

[RequireComponent(typeof(SpriteRenderer))]
public class Door : MonoBehaviour
{
    [SerializeField] private Color closedColor = new Color(0.3f, 0.3f, 0.3f);
    [SerializeField] private Color openColor = new Color(0.4f, 1f, 0.4f);
    [SerializeField] private Sprite openSprite;

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
}
