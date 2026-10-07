"use client";

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function AIModelsPage() {
  const [keys, setKeys] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    provider: '',
    label: '',
    baseUrl: '',
    model: '',
    apiKey: '',
    isActive: false,
  })

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ai/provider')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setKeys(data.keys || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load AI provider keys')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      let res
      if (editingId) {
        res = await fetch(`/api/admin/ai/provider?id=${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        res = await fetch('/api/admin/ai/provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      if (!res.ok) throw new Error('Failed to save')
      await fetchKeys()
      setForm({
        provider: '',
        label: '',
        baseUrl: '',
        model: '',
        apiKey: '',
        isActive: false,
      })
      setEditingId(null)
      toast.success('Saved successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save')
    }
  }

  function handleEdit(key: any) {
    setEditingId(key.id)
    setForm({
      provider: key.provider,
      label: key.label,
      baseUrl: key.baseUrl || '',
      model: key.model,
      apiKey: '', // for security, don't pre-fill the key
      isActive: key.isActive,
    })
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this AI provider key?')) return
    try {
      const res = await fetch(`/api/admin/ai/provider?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      await fetchKeys()
      toast.success('Deleted successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete')
    }
  }

  function handleTest(id: string) {
    // Implement a test endpoint if needed
    toast.info('Testing not implemented yet')
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">AI Provider Keys</h1>
        <Button variant="outline" onClick={() => setEditingId(null)}>
          {editingId ? 'Cancel' : 'Add New'}
        </Button>
      </div>

      {editingId ? (
        <Card className="w-full max-w-xl">
          <CardHeader className="pb-4">
            <CardTitle>{editingId ? 'Edit AI Provider Key' : 'Add New AI Provider Key'}</CardTitle>
            <CardDescription>
              Configure AI provider settings for the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(value) => setForm({ ...form, provider: value })}
                  disabled={!!editingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="zai">Z.AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label (Display Name)</Label>
                <Input
                  id="label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model ID</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  required
                  placeholder="e.g., gpt-4o-mini"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="Enter API key"
                  // For security, we don't want to show the key in the UI when editing
                  // but we need to allow changing it. We'll keep it empty when editing.
                />
                {editingId && (
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep the current key.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">Active</Label>
                <div className="flex items-center">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="outline" type="button" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Button onClick={() => setEditingId(null)}>Add New AI Provider Key</Button>
          </div>
          <div className="space-y-4">
            {keys.map((key) => (
              <Card key={key.id} className="border">
                <CardHeader className="flex justify-between items-start pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-semibold">{key.label}</CardTitle>
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="rounded-full px-2 py-0.5 text-xs">
                        {key.provider}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs">
                        {key.model}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {key.isActive ? (
                      <Button variant="ghost" size="icon" aria-label="Deactivate">
                        <TriangleAlert className="h-4 w-4 text-warning" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" aria-label="Activate">
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(key)}
                      aria-label="Edit"
                    >
                      <Loader2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(key.id)}
                      aria-label="Delete"
                    >
                      <TriangleAlert className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  {!key.isActive && (
                    <div className="mb-2 p-2 bg-warning/10 text-warning rounded">
                      This key is currently inactive.
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="mb-1">
                      <strong>Base URL:</strong> {key.baseUrl || 'Default for provider'}
                    </p>
                    <p className="mb-1">
                      <strong>Created:</strong>{' '}
                      {new Date(key.createdAt).toLocaleString()}
                    </p>
                    {key.lastTestedAt && (
                      <p className="mb-1">
                        <strong>Last tested:</strong> {new Date(key.lastTestedAt).toLocaleString()}
                      </p>
                    )}
                    {key.lastStatus && (
                      <p className="mb-1">
                        <strong>Last status:</strong> {key.lastStatus}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(key.id)}
                  >
                    Test Connection
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}