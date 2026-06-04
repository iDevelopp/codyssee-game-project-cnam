using UnityEngine;

// Coffre interactif — placeholder pour le play test.
// Désactivé tant que le contenu n'est pas implémenté : CanInteract() renvoie false
// pour que PlayerInteraction l'ignore proprement (au lieu de lever une exception).
public class chest : MonoBehaviour, IInteractable
{
    public bool CanInteract() => false;

    public void Interactable()
    {
        // TODO: ouvrir le coffre (récompense, dialogue, etc.)
    }
}
