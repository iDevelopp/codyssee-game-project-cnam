using System;
using System.Collections.Generic;
using UnityEngine;

public class Deck : MonoBehaviour
{
    [SerializeField] private List<CardData> cards = new List<CardData>();

    public event Action<CardData> OnCardAdded;

    public IReadOnlyList<CardData> Cards => cards;
    public int Count => cards.Count;

    public bool Has(CardData card) => cards.Contains(card);

    public void Add(CardData card)
    {
        if (card == null || cards.Contains(card)) return;
        cards.Add(card);
        OnCardAdded?.Invoke(card);
    }

    public void SetCards(IEnumerable<CardData> initial)
    {
        cards.Clear();
        foreach (CardData c in initial) cards.Add(c);
    }
}
