using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
[RequireComponent(typeof(move))]
[RequireComponent(typeof(PlayerInteraction))]
public class Player : MonoBehaviour
{
    private move movement;
    private Rigidbody2D rb;

    private void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        movement = GetComponent<move>();
        movement.rb = rb;
    }
}
