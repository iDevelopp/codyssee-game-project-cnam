using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
[RequireComponent(typeof(move))]
[RequireComponent(typeof(PlayerInteraction))]
[RequireComponent(typeof(Deck))]
public class Player : MonoBehaviour
{
    private move movement;
    private Rigidbody2D rb;

    public Deck Deck { get; private set; }

    private void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        movement = GetComponent<move>();
        movement.rb = rb;
        Deck = GetComponent<Deck>();
    }
}
