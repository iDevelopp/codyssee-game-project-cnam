using UnityEngine;
using UnityEngine.InputSystem;

public class PlayerInteraction : MonoBehaviour
{
    [SerializeField] private float interactionRadius = 1.5f;
    [SerializeField] private LayerMask interactableLayer = ~0;

    private void Update()
    {
        if (Keyboard.current.eKey.wasPressedThisFrame)
        {
            TryInteract();
        }
    }

    private void TryInteract()
    {
        Collider2D[] hits = Physics2D.OverlapCircleAll(transform.position, interactionRadius, interactableLayer);

        IInteractable closest = null;
        float closestDistance = float.MaxValue;

        foreach (Collider2D hit in hits)
        {
            if (hit.gameObject == gameObject) continue;

            IInteractable interactable = hit.GetComponent<IInteractable>();
            if (interactable == null || !interactable.CanInteract()) continue;

            float distance = Vector2.Distance(transform.position, hit.transform.position);
            if (distance < closestDistance)
            {
                closestDistance = distance;
                closest = interactable;
            }
        }

        closest?.Interactable();
    }

    private void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(transform.position, interactionRadius);
    }
}
