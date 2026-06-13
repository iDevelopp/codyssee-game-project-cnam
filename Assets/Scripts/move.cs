using UnityEngine;
using UnityEngine.InputSystem;

public class move : MonoBehaviour
{
    [SerializeField] public Rigidbody2D rb;

    [Header("Animation")]
    [Tooltip("SpriteRenderer du joueur (auto-détecté si laissé vide).")]
    [SerializeField] private SpriteRenderer spriteRenderer;

    [Tooltip("3 sprites bas : pas gauche / immobile / pas droit (neo_zero_char_01_0,1,2).")]
    [SerializeField] private Sprite[] spritesBas = new Sprite[3];

    [Tooltip("3 sprites haut : pas gauche / immobile / pas droit (neo_zero_char_01_3,4,5).")]
    [SerializeField] private Sprite[] spritesHaut = new Sprite[3];

    [Tooltip("3 sprites gauche : pas gauche / immobile / pas droit (neo_zero_char_01_6,7,8). " +
             "La direction droite réutilise ces sprites en miroir horizontal.")]
    [SerializeField] private Sprite[] spritesGauche = new Sprite[3];

    [Tooltip("Vitesse de l'animation de marche, en images par seconde.")]
    [SerializeField] private float framesPerSecond = 8f;

    private enum Facing { Bas, Haut, Gauche, Droite }
    private Facing facing = Facing.Bas;

    // Cycle de marche : immobile -> pas gauche -> immobile -> pas droit, puis on boucle.
    // Les valeurs sont des index dans le tableau de sprites de la direction courante (1 = immobile).
    private static readonly int[] WalkCycle = { 1, 0, 1, 2 };
    private int cyclePos;
    private float frameTimer;

    private float horizontal;
    private float vertical;
    private float speed = 5f;

    private BoxCollider2D boxCollider;
    private ContactFilter2D wallFilter;

    private void Awake()
    {
        if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
        boxCollider = GetComponent<BoxCollider2D>();
        wallFilter = new ContactFilter2D { useTriggers = false, useLayerMask = false };
    }

    private void Update()
    {
        horizontal = 0f;
        vertical = 0f;

        if (IsUIBlockingInput())
        {
            Animate(false);
            return;
        }

        horizontal = Input.GetAxisRaw("Horizontal");
        vertical = Input.GetAxisRaw("Vertical");

        if (horizontal < 0) facing = Facing.Droite;
        else if (horizontal > 0) facing = Facing.Gauche;
        else if (vertical > 0) facing = Facing.Haut;
        else if (vertical < 0) facing = Facing.Bas;

        Vector2 delta = new Vector2(horizontal, vertical) * speed * Time.deltaTime;
        delta = ClampToWalls(delta);
        transform.position += new Vector3(delta.x, delta.y, 0);
        Animate(horizontal != 0f || vertical != 0f);
    }

    private void FixedUpdate() { }

    private Vector2 ClampToWalls(Vector2 delta)
    {
        if (boxCollider == null) return delta;
        const float skin = 0.05f;
        var hits = new RaycastHit2D[1];

        if (delta.x != 0)
        {
            int n = Physics2D.BoxCast(rb.position, boxCollider.size * transform.lossyScale, 0f,
                                      new Vector2(delta.x, 0), wallFilter, hits, Mathf.Abs(delta.x) + skin);
            if (n > 0) delta.x = 0;
        }

        if (delta.y != 0)
        {
            int n = Physics2D.BoxCast(rb.position, boxCollider.size * transform.lossyScale, 0f,
                                      new Vector2(0, delta.y), wallFilter, hits, Mathf.Abs(delta.y) + skin);
            if (n > 0) delta.y = 0;
        }

        return delta;
    }


    private void Animate(bool isMoving)
    {
        if (spriteRenderer == null) return;

        Sprite[] frames = facing switch
        {
            Facing.Haut => spritesHaut,
            Facing.Gauche => spritesGauche,
            Facing.Droite => spritesGauche, // mêmes sprites que "gauche", retournés
            _ => spritesBas,
        };

        // La direction droite est la direction gauche en miroir horizontal.
        spriteRenderer.flipX = facing == Facing.Droite;

        if (isMoving && framesPerSecond > 0f)
        {
            frameTimer += Time.deltaTime;
            float frameDuration = 1f / framesPerSecond;
            while (frameTimer >= frameDuration)
            {
                frameTimer -= frameDuration;
                cyclePos = (cyclePos + 1) % WalkCycle.Length;
            }
        }
        else
        {
            cyclePos = 0;   // position "immobile" du cycle
            frameTimer = 0f;
        }

        int index = WalkCycle[cyclePos];
        if (frames != null && index < frames.Length && frames[index] != null)
        {
            spriteRenderer.sprite = frames[index];
        }
    }

    private static bool IsUIBlockingInput()
    {
        if (DialogueBox.Instance != null && DialogueBox.Instance.IsOpen) return true;
        if (DeckUI.Instance != null && DeckUI.Instance.IsOpen) return true;
        if (EndScreenUI.Instance != null && EndScreenUI.Instance.IsOpen) return true;
        return false;
    }
}
