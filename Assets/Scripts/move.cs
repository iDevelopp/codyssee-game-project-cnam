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

    private void Awake()
    {
        if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
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

        if (Keyboard.current.leftArrowKey.isPressed || Keyboard.current.aKey.isPressed)
        {
            horizontal = -1f;
            facing = Facing.Droite;
        }
        else if (Keyboard.current.rightArrowKey.isPressed || Keyboard.current.dKey.isPressed)
        {
            horizontal = 1f;
            facing = Facing.Gauche;
        }
        else if (Keyboard.current.upArrowKey.isPressed || Keyboard.current.wKey.isPressed)
        {
            vertical = 1f;
            facing = Facing.Haut;
        }
        else if (Keyboard.current.downArrowKey.isPressed || Keyboard.current.sKey.isPressed)
        {
            vertical = -1f;
            facing = Facing.Bas;
        }

        Animate(horizontal != 0f || vertical != 0f);
    }

    private void FixedUpdate()
    {
        rb.linearVelocity = new Vector2(horizontal * speed, vertical * speed);
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
