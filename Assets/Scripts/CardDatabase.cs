using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(fileName = "CardDatabase", menuName = "Codyssey/Card Database", order = 1)]
public class CardDatabase : ScriptableObject
{
    [SerializeField] private List<CardData> allCards = new List<CardData>();

    public IReadOnlyList<CardData> AllCards => allCards;
    public int Count => allCards.Count;

    public List<CardData> PickRandom(int n)
    {
        if (n >= allCards.Count) return new List<CardData>(allCards);

        List<CardData> pool = new List<CardData>(allCards);
        List<CardData> picked = new List<CardData>(n);
        for (int i = 0; i < n; i++)
        {
            int idx = Random.Range(0, pool.Count);
            picked.Add(pool[idx]);
            pool.RemoveAt(idx);
        }
        return picked;
    }

    public List<CardData> GetComplement(IEnumerable<CardData> subset)
    {
        List<CardData> result = new List<CardData>(allCards);
        foreach (CardData c in subset) result.Remove(c);
        return result;
    }
}
