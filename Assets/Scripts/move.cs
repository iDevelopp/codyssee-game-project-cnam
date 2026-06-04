using UnityEngine;
using UnityEngine.InputSystem;

public class move : MonoBehaviour
{
    [SerializeField] public Rigidbody2D rb;

    [SerializeField] private Sprite spriteHaut;
    [SerializeField] private Sprite spriteBas;
    [SerializeField] private Sprite spriteGauche;
    [SerializeField] private Sprite spriteDroite;

    private float horizontal;
    private float vertical;
    private float speed = 5f;
    private bool facingLeft = true;


    void Update()
    {
        horizontal = 0f;
        vertical = 0f;

        if (IsUIBlockingInput()) return;
        
        if (Keyboard.current.leftArrowKey.isPressed || Keyboard.current.aKey.isPressed)
        {
            horizontal = -1f;
        }
        else if (Keyboard.current.rightArrowKey.isPressed || Keyboard.current.dKey.isPressed)
        {
            horizontal = 1f;
        }
        else if (Keyboard.current.upArrowKey.isPressed || Keyboard.current.wKey.isPressed)
        {
            vertical = 1f;
        }
        else if (Keyboard.current.downArrowKey.isPressed || Keyboard.current.sKey.isPressed)
        {
            vertical = -1f;
        }

        Flip();
    }

    private void FixedUpdate()
    {
        rb.linearVelocity = new Vector2(horizontal * speed, vertical * speed);
    }

    private static bool IsUIBlockingInput()
    {
        if (DialogueBox.Instance != null && DialogueBox.Instance.IsOpen) return true;
        if (DeckUI.Instance != null && DeckUI.Instance.IsOpen) return true;
        if (EndScreenUI.Instance != null && EndScreenUI.Instance.IsOpen) return true;
        return false;
    }

    private void Flip()
    {
        if ((facingLeft && horizontal < 0f) || (!facingLeft && horizontal > 0f))
        {
            facingLeft = !facingLeft;
            Vector3 localScale = transform.localScale;
            localScale.x *= -1f;
            transform.localScale = localScale;
        }
    }
}