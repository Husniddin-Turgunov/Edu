import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { encryptKey, keyHint } from '@/lib/ai/key-crypto'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const keys = await prisma.aiProviderKey.findMany({
      select: {
        id: true,
        provider: true,
        label: true,
        model: true,
        isActive: true,
        lastStatus: true,
        lastTestedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ keys })
  } catch (error) {
    console.error('Failed to fetch AI provider keys:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AI provider keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      provider,
      label,
      baseUrl,
      model,
      apiKey, // plaintext API key from client
    } = body

    if (!provider || !label || !model || !apiKey) {
      return NextResponse.json(
        { error: 'Provider, label, model, and API key are required' },
        { status: 400 }
      )
    }

    // Optional: test the API key by making a simple request
    // For now, we'll just store it

    const newKey = await prisma.aiProviderKey.create({
      data: {
        provider,
        label,
        baseUrl: baseUrl || '',
        model,
        keyCipher: encryptKey(apiKey),
        keyHint: keyHint(apiKey),
        isActive: false, // default to inactive until tested
      },
    })

    return NextResponse.json(newKey, { status: 201 })
  } catch (error) {
    console.error('Failed to create AI provider key:', error)
    return NextResponse.json(
      { error: 'Failed to create AI provider key' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      provider,
      label,
      baseUrl,
      model,
      apiKey,
      isActive,
    } = body

    const updateData: any = {}
    if (provider !== undefined) updateData.provider = provider
    if (label !== undefined) updateData.label = label
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl
    if (model !== undefined) updateData.model = model
    if (apiKey !== undefined) {
      updateData.keyCipher = encryptKey(apiKey)
      updateData.keyHint = keyHint(apiKey)
    }
    if (isActive !== undefined) updateData.isActive = isActive

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const updatedKey = await prisma.aiProviderKey.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updatedKey)
  } catch (error) {
    console.error('Failed to update AI provider key:', error)
    return NextResponse.json(
      { error: 'Failed to update AI provider key' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    await prisma.aiProviderKey.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete AI provider key:', error)
    return NextResponse.json(
      { error: 'Failed to delete AI provider key' },
      { status: 500 }
    )
  }
}