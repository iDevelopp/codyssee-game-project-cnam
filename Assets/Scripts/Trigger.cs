using UnityEngine;
using UnityEngine.InputSystem;

public class Trigger : MonoBehaviour
{
    [SerializeField] private bool triggerActive = false;

    private void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Player")) triggerActive = true;
    }

    private void OnTriggerExit2D(Collider2D other)
    {
        if (other.CompareTag("Player")) triggerActive = false;
    }

    private void Update()
    {
        if (triggerActive && Keyboard.current != null && Keyboard.current.spaceKey.wasPressedThisFrame)
        {
            SomeCoolAction();
        }
    }

    public void SomeCoolAction()
    {
        Debug.Log("YO BONJOUR");
    }
}
